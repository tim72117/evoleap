package api

import (
	"encoding/json"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// 主題與清單項目的管理:
//
//	POST   /api/admin/topics                        {id,name,slogan,path}
//	DELETE /api/admin/topics/{id}
//	PUT    /api/admin/topic-order                   {ids}
//	POST   /api/admin/topics/{id}/items             {kind,text,level,at}
//	PATCH  /api/admin/topics/{id}/items/{item}      {text,level}
//	DELETE /api/admin/topics/{id}/items/{item}
//	PUT    /api/admin/topics/{id}/item-order        {kind,ids}
//	POST   /api/admin/topics/{id}/sections                  {id,kind,eyebrow,title,lead,source,variant,at}
//	PATCH  /api/admin/topics/{id}/sections/{section}        {eyebrow,title,lead,source,variant}
//	DELETE /api/admin/topics/{id}/sections/{section}
//	PUT    /api/admin/topics/{id}/section-order             {ids}
//	POST   /api/admin/topics/{id}/blocks                    {section,parent,title,text,note,ref,variant,label,at}
//	PATCH  /api/admin/topics/{id}/blocks/{block}            {title,text,note,ref,variant,label}
//	DELETE /api/admin/topics/{id}/blocks/{block}
//	PUT    /api/admin/topics/{id}/block-order               {section,parent,ids}
//
// 公開讀取:GET /api/topics/{id}/page
//
// 成功都回主題清單裡的那一個主題(含 items)或整份清單。

func decodeTopicBody(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	dec.DisallowUnknownFields()
	if dec.Decode(v) != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤")
		return false
	}
	return true
}

// writeTopicResult 在寫入成功後回主題;id 空的回整份清單。
func (s *Server) writeTopicResult(w http.ResponseWriter, r *http.Request, id string, err error) {
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	topics, err := s.cfg.Store.AdminTopics(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	for _, t := range topics {
		if t.ID == id {
			writeJSON(w, http.StatusOK, t)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"topics": topics})
}

func (s *Server) handleAdminTopicCreate(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct{ ID, Name, Slogan, Path string }
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, in.ID, s.cfg.Store.CreateTopic(r.Context(), user.Email, in.ID, in.Name, in.Slogan, in.Path))
	}
}

func (s *Server) handleAdminTopicDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	s.writeTopicResult(w, r, "", s.cfg.Store.DeleteTopic(r.Context(), user.Email, r.PathValue("id")))
}

func (s *Server) handleAdminTopicOrder(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct{ IDs []string }
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, "", s.cfg.Store.OrderTopics(r.Context(), user.Email, in.IDs))
	}
}

func (s *Server) handleAdminTopicItemAdd(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct {
		Kind, Text, Level string
		At                int
	}
	if decodeTopicBody(w, r, &in) {
		_, err := s.cfg.Store.AddTopicItem(r.Context(), user.Email, r.PathValue("id"), in.Kind, in.Text, in.Level, in.At)
		s.writeTopicResult(w, r, r.PathValue("id"), err)
	}
}

func (s *Server) handleAdminTopicItemSet(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct{ Text, Level *string }
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.SetTopicItem(r.Context(), user.Email, r.PathValue("id"), r.PathValue("item"), in.Text, in.Level))
	}
}

func (s *Server) handleAdminTopicItemDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.DeleteTopicItem(r.Context(), user.Email, r.PathValue("id"), r.PathValue("item")))
}

func (s *Server) handleAdminTopicItemOrder(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct {
		Kind string
		IDs  []string
	}
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.OrderTopicItems(r.Context(), user.Email, r.PathValue("id"), in.Kind, in.IDs))
	}
}

// handleTopicPage 回傳一個主題頁的區塊(公開、不用登入)。
func (s *Server) handleTopicPage(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	sections, err := s.cfg.Store.TopicPage(r.Context(), r.PathValue("id"))
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, map[string]any{"sections": sections})
}

func (s *Server) handleAdminSectionAdd(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct {
		ID, Kind, Eyebrow, Title, Lead, Source, Variant string
		At                                              int
	}
	if decodeTopicBody(w, r, &in) {
		sec := store.PageSection{ID: in.ID, Kind: in.Kind, Eyebrow: in.Eyebrow, Title: in.Title, Lead: in.Lead, Source: in.Source, Variant: in.Variant}
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.AddPageSection(r.Context(), user.Email, r.PathValue("id"), sec, in.At))
	}
}

func (s *Server) handleAdminSectionSet(w http.ResponseWriter, r *http.Request, user store.User) {
	var in store.PageSectionPatch
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.SetPageSection(r.Context(), user.Email, r.PathValue("id"), r.PathValue("section"), in))
	}
}

func (s *Server) handleAdminSectionDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.DeletePageSection(r.Context(), user.Email, r.PathValue("id"), r.PathValue("section")))
}

func (s *Server) handleAdminSectionOrder(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct{ IDs []string }
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.OrderPageSections(r.Context(), user.Email, r.PathValue("id"), in.IDs))
	}
}

func (s *Server) handleAdminBlockAdd(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct {
		Section, Parent, Title, Text, Note, Ref, Variant, Label string
		At                                                      int
	}
	if decodeTopicBody(w, r, &in) {
		b := store.PageBlock{Title: in.Title, Text: in.Text, Note: in.Note, Ref: in.Ref, Variant: in.Variant, Label: in.Label}
		_, err := s.cfg.Store.AddPageBlock(r.Context(), user.Email, r.PathValue("id"), in.Section, in.Parent, b, in.At)
		s.writeTopicResult(w, r, r.PathValue("id"), err)
	}
}

func (s *Server) handleAdminBlockSet(w http.ResponseWriter, r *http.Request, user store.User) {
	var in store.PageBlockPatch
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.SetPageBlock(r.Context(), user.Email, r.PathValue("id"), r.PathValue("block"), in))
	}
}

func (s *Server) handleAdminBlockDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.DeletePageBlock(r.Context(), user.Email, r.PathValue("id"), r.PathValue("block")))
}

func (s *Server) handleAdminBlockOrder(w http.ResponseWriter, r *http.Request, user store.User) {
	var in struct {
		Section, Parent string
		IDs             []string
	}
	if decodeTopicBody(w, r, &in) {
		s.writeTopicResult(w, r, r.PathValue("id"), s.cfg.Store.OrderPageBlocks(r.Context(), user.Email, r.PathValue("id"), in.Section, in.Parent, in.IDs))
	}
}
