# subscription

獨立維護的方案套件:方案等級與使用者的方案紀錄。

這一版從 `feat/subscription` 分支抽出方案與權限的部分,**先不含金流**(Paddle、webhook、付款紀錄、取消重試都還在那個分支)。

## 依賴規則

- 專案可以依賴本套件,本套件不能依賴任何使用它的專案。
- 不知道專案的使用者資料表、登入方式、路由、版型與方案內容;這些都由專案透過介面傳入。

## 結構

| 路徑 | 內容 |
|---|---|
| `go/subscription.go` | 方案清單 `Catalog`(由低到高,`Covers` 比高低)、方案紀錄 `Subscription`、`Service` |
| `go/gormstore/` | `subscriptions` 表的實作,只依賴 gorm |

- `Service.Grant` 寫入專案自己開的方案紀錄,例如使用者選了廣告方案(`Source: "ads"`)。
- `Service.Active` 回傳使用者全部有效的方案紀錄,等級高的在前。有效 = 狀態 active,而且沒有超過期限加上 `Options.Grace` 給這個來源的寬限期(預設 0)。

專案負責提供方案內容(啟動前用 `Catalog.Validate` 檢查)、登入判斷與路由,見 `server/internal/plans/plans.go`、`server/internal/api/plan.go`。

## 單獨檢查

```bash
cd packages/subscription/go && go vet ./... && go test ./...
```
