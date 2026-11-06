package subscription

import (
	"context"
	"errors"
	"time"
)

// ErrInvalidWebhook 是 Provider 驗證不過 webhook(簽章錯誤、內容無法解析)時回傳的錯誤。
var ErrInvalidWebhook = errors.New("subscription: invalid webhook")

// Provider 是金流商要實作的介面,每家金流商一個實作(例如 go/paddle/)。
// 開通與停權只看 ParseWebhook 回傳的事件,不看前端結帳的結果。
type Provider interface {
	// Source 回傳這家金流商的代號,記在訂閱紀錄的 Source。
	Source() Source
	// ClientConfig 回傳前端載入金流商 SDK 需要的公開設定,鍵由各家決定;不需要或沒設定時回傳 nil。
	ClientConfig() map[string]string
	// CreateCheckout 建立一次結帳。
	CreateCheckout(ctx context.Context, req CheckoutRequest) (Checkout, error)
	// ParseWebhook 驗證並解析金流商送來的通知,body 必須是未經處理的原始內容。
	// 驗證不過回傳 ErrInvalidWebhook;通知與訂閱無關時回傳 nil, nil。
	ParseWebhook(headers Header, body []byte) (*Event, error)
	// ParseEvent 解析保存下來的原始內容,不驗證簽章;通知與訂閱無關時回傳 nil, nil。只能用在驗證過的內容。
	ParseEvent(body []byte) (*Event, error)
	// Cancel 取消訂閱,在當期結束時生效;實際的狀態變更仍由之後的事件通知。可能重複呼叫。
	Cancel(ctx context.Context, externalID string) error
	// CancelNow 立刻取消訂閱,顧客不能再撤回;用在全額退款、爭議款與刪除帳號。可能重複呼叫。
	CancelNow(ctx context.Context, externalID string) error
	// PreviewChange 試算把訂閱換成另一個價格時,現在要多收或退回多少(按比例計算),不會真的更換。
	PreviewChange(ctx context.Context, externalID, priceID string) (ChangePreview, error)
	// ChangePlan 把訂閱換成另一個價格(升級、降級或換計費週期),差額按比例立即結算。
	// 已排定取消的訂閱會先取消排定,繼續續訂。實際的方案變更仍由之後的事件通知。
	ChangePlan(ctx context.Context, externalID, priceID string) error
	// ManageLinks 回傳使用者可以自行管理訂閱的網址。網址是暫時的,每次都要重新取得。
	ManageLinks(ctx context.Context, sub Subscription) (ManageLinks, error)
}

// ChangeUnknown 代表金流商這時無法試算(例如已排定取消),金額以更換後的收據為準。
const ChangeUnknown = "unknown"

// ChangePreview 是更換方案的試算結果。金額以幣別的最小單位表示(例如 30000 = NT$300.00)。
type ChangePreview struct {
	// Action 是 charge(現在要收款)、credit(退回額度,之後扣款時折抵)或 ChangeUnknown。
	Action   string `json:"action"`
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// ManageLinks 是管理訂閱的網址。
type ManageLinks struct {
	// URL 是管理入口的總覽。
	URL string
	// UpdatePaymentURL 是更新付款方式的網址;沒有時用 URL。
	UpdatePaymentURL string
}

// Header 是讀取 webhook 標頭需要的方法,http.Header 符合這個介面。
type Header interface {
	Get(key string) string
}

// CheckoutRequest 是建立結帳需要的資料。
type CheckoutRequest struct {
	// UserID 要原樣帶回之後的事件(Event.UserID),訂閱才能記到正確的帳號。
	UserID string
	// PriceID 是金流商的價格 ID,方案與價格的對應在 Plan.Prices。
	PriceID string
}

// Checkout 是建立好的結帳:金流商用轉址就填 URL,用前端 SDK 開啟就填 SessionID。
type Checkout struct {
	URL       string
	SessionID string
}

// EventKind 是事件的種類。
type EventKind string

const (
	// EventChanged 代表訂閱的最新狀態,新增、續訂、扣款失敗、取消都屬於這一種。
	EventChanged EventKind = "changed"
	// EventRevoked 代表全額退款或爭議款成立,要立即停權。只保證有 ID、ExternalID、OccurredAt。
	EventRevoked EventKind = "revoked"
	// EventPaid 代表收到一筆款項,只用來留下付款紀錄,權限還是看訂閱狀態。只保證有 ID、TransactionID、PaidAt、OccurredAt。
	EventPaid EventKind = "paid"
)

// Event 是金流商通知轉成的共通事件,各家的事件名稱與狀態都在 Provider 內轉換。
// 金流商可能重送或亂序送達,Service.Apply 用 ID 跳過處理過的事件,用 OccurredAt 跳過比現有紀錄舊的事件。
type Event struct {
	// ID 是金流商的事件 ID,重送時不變。
	ID   string
	Kind EventKind
	// ExternalID 是金流商的訂閱 ID。
	ExternalID string
	// UserID 來自 CheckoutRequest.UserID。
	UserID string
	// PriceID 是目前訂閱的價格 ID,Service.Apply 用它對應回方案。
	PriceID          string
	Status           Status
	CurrentPeriodEnd *time.Time
	// CancelAt 是已排定取消的時間。
	CancelAt *time.Time
	// CustomerID 是金流商的顧客 ID。
	CustomerID string
	OccurredAt time.Time
	// TransactionID 是金流商的交易 ID,只有 EventPaid 才有。
	TransactionID string
	// PaidAt 是收到款項的時間,只有 EventPaid 才有。
	PaidAt time.Time
}
