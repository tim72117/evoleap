package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# 註解\n\nDOTENV_A=plain\nexport DOTENV_B=\"quoted value\"\nDOTENV_C='single'\nDOTENV_KEEP=from-file\nnot a pair\n=novalue\nDOTENV_EMPTY=\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DOTENV_KEEP", "from-shell") // 已經設定的不覆寫
	for _, k := range []string{"DOTENV_A", "DOTENV_B", "DOTENV_C", "DOTENV_EMPTY"} {
		k := k
		t.Cleanup(func() { os.Unsetenv(k) })
	}

	n, err := loadDotEnv(path)
	if err != nil {
		t.Fatal(err)
	}
	if n != 4 {
		t.Errorf("loaded %d, want 4", n)
	}
	for k, want := range map[string]string{"DOTENV_A": "plain", "DOTENV_B": "quoted value", "DOTENV_C": "single", "DOTENV_KEEP": "from-shell", "DOTENV_EMPTY": ""} {
		if got, ok := os.LookupEnv(k); !ok || got != want {
			t.Errorf("%s = %q (set %v), want %q", k, got, ok, want)
		}
	}
}

func TestLoadDotEnvMissingFile(t *testing.T) {
	n, err := loadDotEnv(filepath.Join(t.TempDir(), "nope.env"))
	if err != nil || n != 0 {
		t.Errorf("missing file: n=%d err=%v", n, err)
	}
}
