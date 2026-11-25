package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/tim72117/evoleap/internal/store"
)

// 管理員管理課程資訊的譯文(evoleap i18n …;全部經 requireAdmin)。欄位的鍵是 kind、ref、path、lang(ref 含 /,所以放在查詢參數):
//
//	GET /api/admin/i18n?lang=&kind=&ref=&status=&stale=1&limit=   列出譯文(附原文與是否過時)
//	GET /api/admin/i18n/item?kind=&ref=&path=&lang=                 一筆譯文與它的異動紀錄
//	GET /api/admin/i18n/missing?lang=&kind=                         登記表有、譯文沒有或過時的欄位
//	PUT /api/admin/i18n                                             寫入一筆譯文(body 是 store.I18nSet;記異動紀錄)

func (s *Server) handleAdminI18nList(w http.ResponseWriter, r *http.Request, _ store.User) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	items, err := s.cfg.Store.ListI18n(r.Context(), store.I18nFilter{
		Lang: q.Get("lang"), Kind: q.Get("kind"), Ref: q.Get("ref"), Status: q.Get("status"),
		StaleOnly: q.Get("stale") == "1" || q.Get("stale") == "true", Limit: limit,
	})
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleAdminI18nGet(w http.ResponseWriter, r *http.Request, _ store.User) {
	q := r.URL.Query()
	item, hist, err := s.cfg.Store.GetI18n(r.Context(), q.Get("kind"), q.Get("ref"), q.Get("path"), q.Get("lang"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這筆譯文")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": item, "history": hist})
}

func (s *Server) handleAdminI18nMissing(w http.ResponseWriter, r *http.Request, _ store.User) {
	q := r.URL.Query()
	lang := q.Get("lang")
	if lang == "" {
		lang = store.LangEN
	}
	items, err := s.cfg.Store.MissingI18n(r.Context(), lang, q.Get("kind"))
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lang": lang, "items": items})
}

func (s *Server) handleAdminI18nSet(w http.ResponseWriter, r *http.Request, user store.User) {
	var in store.I18nSet
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤(或內容超過 128KB)")
		return
	}
	item, err := s.cfg.Store.SetI18n(r.Context(), user.Email, in)
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}
