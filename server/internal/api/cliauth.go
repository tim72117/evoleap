package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"github.com/tim72117/evoleap/internal/store"
)

// evoleap CLI 的瀏覽器核准登入(evoleap login --web),流程見 store/cliauth.go:
//
//	POST /api/cli-auth/start          CLI 登記本機 loopback 網址,拿回 id(不用登入,依來源 IP 限流)
//	GET  /api/cli-auth/{id}           核准頁讀要顯示的 CLI 名稱(不用登入)
//	POST /api/cli-auth/{id}/approve   管理員在核准頁按核准:簽發 token,回傳要把瀏覽器導回去的 CLI 網址(帶 id 與一次性驗證碼)
//	POST /api/cli-auth/exchange       CLI 用 id 加驗證碼換 token(只能換一次;只有 id 換不到,見 store/cliauth.go)
//
//	POST /api/cli-auth/logout        撤銷帶來的這個 CLI token(evoleap logout)
//	GET  /api/admin/cli-tokens        列出還有效的 CLI 登入(只給管理員)
//	DELETE /api/admin/cli-tokens/{id} 撤銷一個 CLI 登入(只給管理員)
//
// 只有管理員能核准:CLI 拿到的 token 代表那位管理員,用來呼叫 /api/admin/*(Authorization: Bearer)。
// 它不是網站登入的 JWT,而是存在資料庫的隨機字串,有效期 7 天、可以撤銷(見 store/clitokens.go)。

func (s *Server) handleCliAuthStart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RedirectURI string `json:"redirect_uri"`
		Name        string `json:"name"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤")
		return
	}
	id, err := s.cfg.Store.StartCliAuth(r.Context(), body.RedirectURI, body.Name)
	if errors.Is(err, store.ErrCliAuthInvalid) {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (s *Server) handleCliAuthGet(w http.ResponseWriter, r *http.Request) {
	name, err := s.cfg.Store.CliAuthName(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrCliAuthNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "登入要求不存在或已過期,請在終端機重新執行 evoleap login --web")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}

func (s *Server) handleCliAuthApprove(w http.ResponseWriter, r *http.Request, user store.User) {
	// 本機 -open-studio 不檢查管理員,但核准一定要有登入的人:token 就是這個人的身分
	if user.ID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
		return
	}
	id := r.PathValue("id")
	redirect, code, err := s.cfg.Store.ApproveCliAuth(r.Context(), id, user.ID)
	if errors.Is(err, store.ErrCliAuthNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "登入要求不存在、已過期或已經核准過")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	u, err := url.Parse(redirect)
	if err != nil {
		internalError(w, err)
		return
	}
	q := u.Query()
	q.Set("id", id)
	q.Set("code", code)
	u.RawQuery = q.Encode()
	writeJSON(w, http.StatusOK, map[string]string{"redirect": u.String()})
}

func (s *Server) handleCliAuthExchange(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID   string `json:"id"`
		Code string `json:"code"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil || body.ID == "" || body.Code == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤")
		return
	}
	token, err := s.cfg.Store.ExchangeCliAuth(r.Context(), body.ID, body.Code)
	if errors.Is(err, store.ErrCliAuthNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "還沒核准、已過期、已經換過或驗證碼不對")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (s *Server) handleCliLogout(w http.ResponseWriter, r *http.Request) {
	token := bearerCliToken(r)
	if token == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "沒有帶 CLI token")
		return
	}
	if err := s.cfg.Store.RevokeCliTokenValue(r.Context(), token); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleCliTokens(w http.ResponseWriter, r *http.Request, _ store.User) {
	tokens, err := s.cfg.Store.CliTokens(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"tokens": tokens})
}

func (s *Server) handleCliTokenRevoke(w http.ResponseWriter, r *http.Request, _ store.User) {
	err := s.cfg.Store.RevokeCliToken(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這個 CLI 登入(可能已經撤銷或過期)")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
