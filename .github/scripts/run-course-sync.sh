#!/usr/bin/env bash
# 執行課程同步工作(Cloud Run Job):用給定的 image 執行 server -sync-only,
# 把 courses_seed.json 的課程、單元、每一課與腳本檔寫進資料庫,寫完就結束。
# 部署(deploy-cloudrun.yml)與只同步課程(sync-courses.yml)共用這支,參數由兩邊的 env 提供:
#   GCP_PROJECT_ID、CLOUD_RUN_REGION、CLOUDSQL_INSTANCE、CLOUD_RUN_SYNC_JOB
# 用法:.github/scripts/run-course-sync.sh <image>
# 執行帳號(預設的 Compute Engine 服務帳號,和網站相同)要能讀 EVOLEAP_DATABASE_URL 並連 Cloud SQL;
# 呼叫的服務帳號要能建立與執行 Cloud Run Job(roles/run.admin 或 roles/run.developer)。
set -euo pipefail

image="${1:?用法:run-course-sync.sh <image>}"

gcloud run jobs deploy "$CLOUD_RUN_SYNC_JOB" \
  --image="$image" \
  --region="$CLOUD_RUN_REGION" \
  --project="$GCP_PROJECT_ID" \
  --args=-sync-only \
  --set-cloudsql-instances="$CLOUDSQL_INSTANCE" \
  --set-secrets="DATABASE_URL=EVOLEAP_DATABASE_URL:latest" \
  --tasks=1 \
  --max-retries=1 \
  --task-timeout=5m \
  --quiet

gcloud run jobs execute "$CLOUD_RUN_SYNC_JOB" \
  --region="$CLOUD_RUN_REGION" \
  --project="$GCP_PROJECT_ID" \
  --wait
