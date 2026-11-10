package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

// 登入 token 存在使用者設定目錄(macOS 是 ~/Library/Application Support、Linux 是 ~/.config)的 evoleap/ 底下,
// 依 -api 的主機分開存(檔名是主機網址的 SHA-256),本機與正式環境的登入互不覆蓋(仿照 tripace-cli 的 token.go)。
// 不放在專案目錄,免得被誤 commit;權限 0600,內容就是登入憑證(有效期 7 天,evoleap logout 會在伺服器撤銷)。

func tokenPath(api string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(api))
	return filepath.Join(dir, "evoleap", "token-"+hex.EncodeToString(sum[:])), nil
}

func saveToken(api, token string) error {
	path, err := tokenPath(api)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(token), 0o600)
}

func loadToken(api string) (string, error) {
	path, err := tokenPath(api)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(path)
	return strings.TrimSpace(string(b)), err
}

func deleteToken(api string) error {
	path, err := tokenPath(api)
	if err != nil {
		return err
	}
	return os.Remove(path)
}
