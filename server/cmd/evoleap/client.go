package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// client 呼叫 evoleap 伺服器的 API,帶上這個主機的登入 token(Authorization: Bearer)。
type client struct {
	api   string
	token string
	http  *http.Client
}

func newClient(api string) *client {
	token, _ := loadToken(api)
	return &client{api: api, token: token, http: &http.Client{Timeout: 60 * time.Second}}
}

// raw 送出請求,回傳成功時的原始內容;失敗時把伺服器的錯誤訊息轉成 error
func (c *client) raw(method, path string, body []byte) ([]byte, error) {
	req, err := http.NewRequest(method, c.api+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 300 {
		var e struct{ Message string }
		_ = json.Unmarshal(data, &e)
		switch {
		case res.StatusCode == http.StatusUnauthorized:
			return nil, fmt.Errorf("沒有登入或登入已過期,請先執行 evoleap login(%s)", c.api)
		case res.StatusCode == http.StatusForbidden && e.Message != "":
			return nil, fmt.Errorf("沒有權限:%s", e.Message)
		case e.Message != "":
			return nil, fmt.Errorf("%s(HTTP %d)", e.Message, res.StatusCode)
		}
		return nil, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return data, nil
}

// do 送出 JSON(body 為 nil 時不送)並把回應解進 out
func (c *client) do(method, path string, body any, out any) error {
	var b []byte
	if body != nil {
		var err error
		if b, err = json.Marshal(body); err != nil {
			return err
		}
	}
	return c.doBody(method, path, b, out)
}

// doBody 送出已經是 JSON 的內容(例如腳本檔)並把回應解進 out
func (c *client) doBody(method, path string, body []byte, out any) error {
	data, err := c.raw(method, path, body)
	if err != nil {
		return err
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}
