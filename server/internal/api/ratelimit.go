package api

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// 登入與註冊的限流。狀態存在各實例的記憶體裡,實例重啟就歸零、多個實例各算各的:
// 目的是擋住大量猜密碼與消耗 CPU 的請求,不需要精確。

// loginEmailLimit 是同一個 Email 每分鐘可嘗試密碼登入的次數,防止從多個 IP 猜同一個帳號。
const loginEmailLimit = 10

// rateLimiterMaxKeys 是清理過期紀錄的門檻,避免偽造大量 key 把記憶體用完。
const rateLimiterMaxKeys = 10000

type rateWindow struct {
	start time.Time
	count int
}

// rateLimiter 是固定時間窗的計數器。
type rateLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string]rateWindow
}

func newRateLimiter(max int, window time.Duration) *rateLimiter {
	return &rateLimiter{max: max, window: window, hits: map[string]rateWindow{}}
}

// allow 記一次嘗試,回報這次是否還在額度內。
func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.hits) >= rateLimiterMaxKeys {
		for k, w := range l.hits {
			if now.Sub(w.start) >= l.window {
				delete(l.hits, k)
			}
		}
		// 全部都還在時間窗內時直接重來:寧可短暫放行,也不讓記憶體無限成長。
		if len(l.hits) >= rateLimiterMaxKeys {
			l.hits = map[string]rateWindow{}
		}
	}
	w := l.hits[key]
	if now.Sub(w.start) >= l.window {
		w = rateWindow{start: now}
	}
	w.count++
	l.hits[key] = w
	return w.count <= l.max
}

// limitAuth 依來源 IP 限流;沒有設定 AuthRateLimit 時直接放行。
func (s *Server) limitAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.authIP != nil && !s.authIP.allow(clientIP(r)) {
			writeRateLimited(w)
			return
		}
		h(w, r)
	}
}

func (s *Server) allowLoginEmail(email string) bool {
	return s.loginEmail == nil || s.loginEmail.allow(email)
}

func writeRateLimited(w http.ResponseWriter) {
	w.Header().Set("Retry-After", "60")
	writeError(w, http.StatusTooManyRequests, "rate_limited", "嘗試次數太多，請一分鐘後再試")
}

// clientIP 取真實來源 IP。X-Forwarded-For 每經過一層代理在尾端加一筆,前面的值用戶端可以任意偽造,
// 所以只取最後一筆:Cloud Run 直接面對外部流量時,那一筆就是 Google 代理看到的連線來源(同 tripace)。
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		if last := strings.TrimSpace(parts[len(parts)-1]); last != "" {
			return last
		}
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
