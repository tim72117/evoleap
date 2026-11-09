# Shuttle server 容器映像。
# build context 為「專案根目錄」,COPY 路徑相對根目錄寫(server/...、web/...)。
#
# web/ 的 Vite build 產物複製進 server/cmd/server/web/dist/,對應
# cmd/server/static.go 的 go:embed web/dist——路徑必須一致,否則 embed 到的
# 只會是版控裡的 placeholder index.html。
#
# 建置(從專案根目錄):
#   docker build -t shuttle-server .
# 本機跑:
#   docker run --rm -p 8080:8080 shuttle-server

# ---- 階段 1:build 前端 ----
FROM node:22-alpine AS web-build
WORKDIR /repo/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# GA4 評估 ID(Vite 於 build 時內嵌):docker build --build-arg VITE_GA_MEASUREMENT_ID=G-XXXX。
# 未傳或留空時前端完全不載入 Google Analytics。
ARG VITE_GA_MEASUREMENT_ID=""
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
# AdSense 發布商 ID 與廣告單元 ID(Vite 於 build 時內嵌);任一個留空時前端完全不載入 AdSense。
ARG VITE_ADSENSE_CLIENT=""
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT
ARG VITE_ADSENSE_SLOT=""
ENV VITE_ADSENSE_SLOT=$VITE_ADSENSE_SLOT
# build 含 scripts/seo.mjs:產生各路由的 HTML(SEO 標籤)、404.html、sitemap.xml、robots.txt。
RUN npm run build

# ---- 階段 2:編譯 Go ----
FROM golang:1.26 AS build

# 先單獨複製 go.mod(有 go.sum 時一併)以利 layer 快取。
COPY server/go.mod server/go.su[m] /src/server/
RUN cd /src/server && go mod download

COPY server/ /src/server/

# 先清掉 placeholder,再放入真正的前端 build 產物。
RUN rm -rf /src/server/cmd/server/web/dist/*
COPY --from=web-build /repo/web/dist/. /src/server/cmd/server/web/dist/

RUN cd /src/server && go test ./...

# 靜態編譯:關 CGO 產出不依賴 libc 的單一執行檔,可放進極小的 base image。
RUN cd /src/server && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/server ./cmd/server

# ---- 階段 3:執行 ----
# distroless:只含執行檔需要的最小 runtime,無 shell、體積小、攻擊面小。
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/server /app/server

# Cloud Run 會注入 PORT(預設 8080);main.go 讀 PORT 覆寫監聽位址。
EXPOSE 8080
ENTRYPOINT ["/app/server"]
