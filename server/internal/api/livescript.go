package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/tim72117/evoleap/internal/store"
)

// 即時腳本:管理員在 AI 工具裡透過 MCP(evoleap mcp)改一份「臨時腳本」,研發基地的 /studio/live-script 訂閱它,
// 每次修改都即時推到頁面、舞台照新腳本演出;頁面把載入的結果(成功的長度,或錯在哪一步)回報回來,AI 讀腳本時一起看得到。
//
// 臨時腳本只放在這台伺服器的記憶體(每位管理員一份),重啟就沒了;正式環境 Cloud Run 可能有好幾台執行個體、彼此不共用,
// 所以這是給本機開發用的(正式站也能用,但 MCP 和頁面可能連到不同台)。存成正式的腳本檔要另外用 evoleap script push。
//
//   GET    /api/live-script               目前的腳本、版本與頁面回報的載入結果
//   PUT    /api/live-script               整份取代 {"script": {...}}
//   POST   /api/live-script/steps         插入一步 {"step": {...}, "at": 第幾個位置(0 起算,省略就加在最後)}
//   PATCH  /api/live-script/steps/{n}     改第 n 步(1 起算)的欄位 {"set": {...}};值是 null 的欄位刪掉
//   DELETE /api/live-script/steps/{n}     刪第 n 步(1 起算)
//   GET    /api/live-script/events        SSE:連上時先送目前版本,之後每次修改送一次(event: script)
//   POST   /api/live-script/report        頁面回報載入結果 {"version": n, "error": "…" 或 null, "duration": 毫秒}

const liveScriptMaxBytes = 512 << 10

// liveDoc 是一位管理員的臨時腳本。
type liveDoc struct {
	version int
	script  map[string]any
	report  *liveReport
	subs    map[chan liveSnapshot]struct{}
}

// liveReport 是頁面載入某一版的結果。
type liveReport struct {
	Version int    `json:"version"`
	Error   string `json:"error,omitempty"`
	// Duration 是舞台的長度(毫秒,舞台算出來可能有小數)
	Duration float64   `json:"duration,omitempty"`
	At       time.Time `json:"at"`
}

// liveSnapshot 是 GET 與推播的內容。
type liveSnapshot struct {
	Version int            `json:"version"`
	Script  map[string]any `json:"script"`
	// Report 是頁面回報的載入結果;沒有頁面在看、或還沒回報這一版時是 null(或是舊版的結果)
	Report *liveReport `json:"report"`
}

type liveScripts struct {
	mu   sync.Mutex
	docs map[string]*liveDoc
}

func newLiveScripts() *liveScripts { return &liveScripts{docs: map[string]*liveDoc{}} }

// emptyLiveScript 是一開始的腳本:舞台需要至少一位演員,這裡放一個空白的瀏覽器,步驟是空的。
func emptyLiveScript() map[string]any {
	return map[string]any{
		"title": "即時腳本",
		"cast":  map[string]any{"browser": map[string]any{"actor": "browser", "props": map[string]any{}}},
		"steps": []any{},
	}
}

func (l *liveScripts) doc(userID string) *liveDoc {
	d := l.docs[userID]
	if d == nil {
		d = &liveDoc{script: emptyLiveScript(), subs: map[chan liveSnapshot]struct{}{}}
		l.docs[userID] = d
	}
	return d
}

func (d *liveDoc) snapshot() liveSnapshot {
	return liveSnapshot{Version: d.version, Script: cloneJSON(d.script), Report: d.report}
}

// update 在鎖裡改腳本;改成功就加版本並推給訂閱的頁面。
func (l *liveScripts) update(userID string, change func(script map[string]any) (map[string]any, error)) (liveSnapshot, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	d := l.doc(userID)
	next, err := change(cloneJSON(d.script))
	if err != nil {
		return liveSnapshot{}, err
	}
	if err := checkLiveScript(next); err != nil {
		return liveSnapshot{}, err
	}
	d.script = next
	d.version++
	snap := d.snapshot()
	for ch := range d.subs {
		select {
		case ch <- snap:
		default: // 頁面來不及收:丟掉中間版本,下一次推最新的
		}
	}
	return snap, nil
}

func (l *liveScripts) get(userID string) liveSnapshot {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.doc(userID).snapshot()
}

func (l *liveScripts) subscribe(userID string) (chan liveSnapshot, liveSnapshot, func()) {
	l.mu.Lock()
	defer l.mu.Unlock()
	d := l.doc(userID)
	ch := make(chan liveSnapshot, 1)
	d.subs[ch] = struct{}{}
	return ch, d.snapshot(), func() {
		l.mu.Lock()
		delete(d.subs, ch)
		l.mu.Unlock()
	}
}

func (l *liveScripts) setReport(userID string, r liveReport) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	d := l.doc(userID)
	if r.Version != d.version {
		return fmt.Errorf("回報的是第 %d 版,目前是第 %d 版", r.Version, d.version)
	}
	r.At = time.Now()
	d.report = &r
	return nil
}

// errLiveScript 是腳本或請求不合規則(400)。
type errLiveScript struct{ msg string }

func (e errLiveScript) Error() string { return e.msg }

func badLive(format string, a ...any) error { return errLiveScript{fmt.Sprintf(format, a...)} }

// checkLiveScript 只檢查結構(cast 是物件、至少一位演員、steps 是物件的陣列);演員認不認得動作由頁面載入時檢查並回報。
func checkLiveScript(s map[string]any) error {
	cast, ok := s["cast"].(map[string]any)
	if !ok || len(cast) == 0 {
		return badLive("腳本要有 cast(演員表),至少一位演員,例如 {\"b\": {\"actor\": \"browser\"}}")
	}
	for id, c := range cast {
		e, ok := c.(map[string]any)
		if !ok {
			return badLive("cast.%s 要是物件", id)
		}
		if a, _ := e["actor"].(string); a == "" {
			return badLive("cast.%s 要寫 actor(演員名稱)", id)
		}
	}
	steps, ok := s["steps"].([]any)
	if !ok {
		return badLive("腳本要有 steps(步驟的陣列)")
	}
	for i, st := range steps {
		if _, ok := st.(map[string]any); !ok {
			return badLive("第 %d 步要是物件", i+1)
		}
	}
	return nil
}

func cloneJSON(v map[string]any) map[string]any {
	b, _ := json.Marshal(v)
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	return out
}

func readLiveBody(w http.ResponseWriter, r *http.Request, v any) error {
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, liveScriptMaxBytes))
	if err != nil {
		return badLive("內容太大(上限 %d KB)", liveScriptMaxBytes>>10)
	}
	if err := json.Unmarshal(b, v); err != nil {
		return badLive("不是正確的 JSON:%v", err)
	}
	return nil
}

func writeLive(w http.ResponseWriter, snap liveSnapshot, err error) {
	if err != nil {
		if _, ok := err.(errLiveScript); ok {
			writeError(w, http.StatusBadRequest, "invalid_script", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "伺服器錯誤")
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

// stepIndex 把網址的第 n 步(1 起算)換成陣列索引。
func stepIndex(r *http.Request, steps []any) (int, error) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 || n > len(steps) {
		return 0, badLive("沒有第 %s 步(目前共 %d 步,從 1 算起)", r.PathValue("n"), len(steps))
	}
	return n - 1, nil
}

func (s *Server) handleLiveGet(w http.ResponseWriter, r *http.Request, user store.User) {
	writeJSON(w, http.StatusOK, s.live.get(user.ID))
}

func (s *Server) handleLivePut(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		Script map[string]any `json:"script"`
	}
	if err := readLiveBody(w, r, &body); err != nil {
		writeLive(w, liveSnapshot{}, err)
		return
	}
	if body.Script == nil {
		writeLive(w, liveSnapshot{}, badLive("要寫 script(整份腳本)"))
		return
	}
	snap, err := s.live.update(user.ID, func(map[string]any) (map[string]any, error) { return body.Script, nil })
	writeLive(w, snap, err)
}

func (s *Server) handleLiveStepAdd(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		Step map[string]any `json:"step"`
		At   *int           `json:"at"`
	}
	if err := readLiveBody(w, r, &body); err != nil {
		writeLive(w, liveSnapshot{}, err)
		return
	}
	if body.Step == nil {
		writeLive(w, liveSnapshot{}, badLive("要寫 step(一步的內容)"))
		return
	}
	snap, err := s.live.update(user.ID, func(sc map[string]any) (map[string]any, error) {
		steps, _ := sc["steps"].([]any)
		at := len(steps)
		if body.At != nil {
			if *body.At < 0 || *body.At > len(steps) {
				return nil, badLive("at 要在 0 到 %d 之間", len(steps))
			}
			at = *body.At
		}
		next := append(append(append([]any{}, steps[:at]...), body.Step), steps[at:]...)
		sc["steps"] = next
		return sc, nil
	})
	writeLive(w, snap, err)
}

func (s *Server) handleLiveStepUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		Set map[string]any `json:"set"`
	}
	if err := readLiveBody(w, r, &body); err != nil {
		writeLive(w, liveSnapshot{}, err)
		return
	}
	if len(body.Set) == 0 {
		writeLive(w, liveSnapshot{}, badLive("要寫 set(要改的欄位;值寫 null 代表刪掉)"))
		return
	}
	snap, err := s.live.update(user.ID, func(sc map[string]any) (map[string]any, error) {
		steps, _ := sc["steps"].([]any)
		i, err := stepIndex(r, steps)
		if err != nil {
			return nil, err
		}
		step, _ := steps[i].(map[string]any)
		for k, v := range body.Set {
			if v == nil {
				delete(step, k)
			} else {
				step[k] = v
			}
		}
		if len(step) == 0 {
			return nil, badLive("第 %d 步的欄位都刪光了,要刪掉整步請用刪除", i+1)
		}
		return sc, nil
	})
	writeLive(w, snap, err)
}

func (s *Server) handleLiveStepDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	snap, err := s.live.update(user.ID, func(sc map[string]any) (map[string]any, error) {
		steps, _ := sc["steps"].([]any)
		i, err := stepIndex(r, steps)
		if err != nil {
			return nil, err
		}
		sc["steps"] = append(append([]any{}, steps[:i]...), steps[i+1:]...)
		return sc, nil
	})
	writeLive(w, snap, err)
}

func (s *Server) handleLiveReport(w http.ResponseWriter, r *http.Request, user store.User) {
	var body liveReport
	if err := readLiveBody(w, r, &body); err != nil {
		writeLive(w, liveSnapshot{}, err)
		return
	}
	if err := s.live.setReport(user.ID, body); err != nil {
		writeError(w, http.StatusConflict, "stale_version", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// liveHeartbeat 是 SSE 的心跳間隔:讓中間的代理不要因為沒有資料而斷線,也讓伺服器發現頁面已經關掉。
var liveHeartbeat = 20 * time.Second

func (s *Server) handleLiveEvents(w http.ResponseWriter, r *http.Request, user store.User) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "internal", "不支援即時推播")
		return
	}
	ch, first, cancel := s.live.subscribe(user.ID)
	defer cancel()
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	send := func(snap liveSnapshot) bool {
		b, err := json.Marshal(snap)
		if err != nil {
			return false
		}
		if _, err := fmt.Fprintf(w, "event: script\ndata: %s\n\n", b); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}
	if !send(first) {
		return
	}
	tick := time.NewTicker(liveHeartbeat)
	defer tick.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case snap := <-ch:
			if !send(snap) {
				return
			}
		case <-tick.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
