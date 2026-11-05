# subscription

獨立維護的訂閱套件:方案、權益與訂閱狀態。

## 依賴規則

- 專案可以依賴本套件,本套件不能依賴任何使用它的專案。
- 不知道專案的使用者資料表、登入方式、路由、版型與方案內容;這些都由專案透過介面傳入。

## 結構

| 路徑 | 內容 |
|---|---|
| `go/` | Go 模組,核心只用標準函式庫 |
| `go/provider.go` | 金流商介面 `Provider` 與共通事件 `Event` |
| `go/paddle/` | 用 Paddle Billing 實作 `Provider`,只用標準函式庫 |
| `go/httpapi/` | HTTP handler,只用標準 `net/http` |
| `go/gormstore/` | 資料表實作,只依賴 gorm |

事件由 `httpapi.Handler.Webhook` 接收,交給 `Service.Apply` 在同一個交易內寫入事件、訂閱紀錄與要做的工作;向金流商取消訂閱由 `Service.RunTasks` 執行,失敗會重試。專案要在背景跑 `Service.Run`。`Handler.Plans`、`Handler.Checkout`、`Handler.Manage` 列出方案與價格、建立結帳、取得管理網址。方案與價格的對應放在 `Plan.Prices`,由專案傳入。還沒有對 Paddle sandbox 實際測試過。

## 金流出錯時的防護

- `Service.Apply` 把每個事件和處理結果寫進 `subscription_events`,對不上帳號、價格或重複訂閱都查得到。紀錄長期保存,本套件不會自動刪除。
- 權限除了看狀態,也看當期結束時間加上 7 天寬限期,遺失取消事件時不會永久有效。扣款失敗(`past_due`)時由金流商重試結束後的事件決定,當期結束後最多保留 35 天。
- 每筆金流商的訂閱一列(`subscriptions`),權限看使用者有沒有任一筆有效。同一個使用者已有有效訂閱時,新的那筆標記為重複,會在當期結束時取消,已付款項要人工退款。
- 事件的原始內容保存 90 天,可以用 `Service.Replay` 重新處理,例如補上方案價格之後;之後只留事件紀錄。
- 取消訂閱排進 `subscription_tasks`,金流商出錯不會讓事件失敗。重試 10 次仍失敗就放棄並留下紀錄,要人工處理。
- 退款比訂閱事件先到時會留下已退款的紀錄,之後的事件不會讓它恢復。
- 訂閱事件對不上帳號時仍會保存狀態,之後的事件或交易帶了帳號就補上。已記下的帳號不會被事件改掉;`Options.UserExists` 過濾不存在的帳號。
- 每筆收到的款項寫進 `subscription_payments`(交易與訂閱編號、使用者、價格、付款時間),對不上帳號或價格也會留下。這份紀錄只用來對帳與退款,權限還是看訂閱狀態;金額與發票以金流商為準。Paddle 的通知目的地要勾選 `transaction.completed`。

專案負責提供方案內容(啟動前用 `Catalog.Validate` 檢查)、登入判斷與路由,見 `server/internal/plans/plans.go`、`server/internal/api/plan.go`。本套件不含前端,目前也沒有畫面使用 API。

## 單獨檢查

```bash
cd packages/subscription/go && go vet ./...
```
