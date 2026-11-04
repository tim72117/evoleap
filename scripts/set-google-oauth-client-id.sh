#!/usr/bin/env bash
# 把 Google OAuth 用戶端 ID 寫入 Secret Manager,並開放 Cloud Run 的執行帳號讀取。
# 可重複執行:值沒變就不新增版本。只動 EVOLEAP_GOOGLE_OAUTH_CLIENT_ID 這個機密,不動部署設定。
#
# 用法(Windows 請用 Git Bash):
#   scripts/set-google-oauth-client-id.sh 123-abc.apps.googleusercontent.com
set -euo pipefail

PROJECT="shuttle-045094509"
SECRET="EVOLEAP_GOOGLE_OAUTH_CLIENT_ID"
RUNTIME_SA="340121279179-compute@developer.gserviceaccount.com"

if [ "$#" -ne 1 ]; then
  echo "用法:$0 <Client ID>" >&2
  exit 2
fi
CLIENT_ID="$1"

if ! printf '%s' "$CLIENT_ID" | grep -Eq '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$'; then
  echo "這不是 Client ID 的格式(應為 數字-英數字.apps.googleusercontent.com)。" >&2
  echo "請確認貼的不是 Client Secret;這個專案不需要 Client Secret。" >&2
  exit 2
fi

# 用 printf 寫入:多一個換行,Google 登入比對 Client ID 時就會失敗。
if gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  CURRENT="$(gcloud secrets versions access latest --secret="$SECRET" --project="$PROJECT" 2>/dev/null | tr -d '\r' || true)"
  if [ "$CURRENT" = "$CLIENT_ID" ]; then
    echo "機密的值沒有變更,不新增版本。"
  else
    printf '%s' "$CLIENT_ID" | gcloud secrets versions add "$SECRET" --data-file=- --project="$PROJECT"
  fi
else
  printf '%s' "$CLIENT_ID" | gcloud secrets create "$SECRET" --data-file=- --project="$PROJECT"
fi

gcloud secrets add-iam-policy-binding "$SECRET" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT" >/dev/null

STORED="$(gcloud secrets versions access latest --secret="$SECRET" --project="$PROJECT" | tr -d '\r')"
if [ "$STORED" != "$CLIENT_ID" ]; then
  echo "寫入後讀回的值不一致,請檢查 $SECRET。" >&2
  exit 1
fi

echo "完成:$SECRET 已寫入,Cloud Run 執行帳號可讀取。"
echo "接著還要在 deploy workflow 加上 --update-secrets,並設定資料庫,登入才會啟用。"
