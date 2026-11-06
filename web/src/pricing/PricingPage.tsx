import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type PlanChangePreview, type PlanMe } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { ACCESS_LABEL } from '../content/levels'
import { SOFTWARE_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import {
  BILLING_PERIODS,
  cardAction,
  checkoutPeriodOf,
  formatAmount,
  FREE_LEVELS,
  manageTarget,
  paidTierOf,
  pricingHref,
  returnPathOf,
  stageLabel,
  subscriptionNotice,
  TIER_LEVELS,
  yearlySavingPercent,
  type BillingPeriod,
  type CardAction,
  type PaidTier,
} from './plans'
import styles from './PricingPage.module.css'
import { usePaddle } from './usePaddle'

// 付款模式是訂閱制,分基礎與進階兩個方案,各有月繳與年繳(年繳比較便宜)。進階方案包含基礎方案的課程。
// 開通與換方案只看後端收到的 webhook,不看這裡的結果,所以操作後要重新確認。
// 版面:置中的標題,月繳/年繳切換鈕,下面是免費、基礎、進階三張方案卡;卡片只列課程階段,不列課名。
const PLAN_POLL_MS = 3000
const PLAN_POLL_TIMES = 6

const CHECKOUT_ERROR = '結帳無法開始，請稍後再試。'

/** 付款日起可申請全額退款的天數,和退款政策一致 */
const REFUND_DAYS = 14

const PAID_TIERS: { tier: PaidTier; name: string; includesBasic?: boolean }[] = [
  { tier: 'basic', name: '基礎方案' },
  { tier: 'advanced', name: '進階方案', includesBasic: true },
]

const PERIOD_TEXT: Record<BillingPeriod, { per: string; note: string }> = {
  monthly: { per: '/ 月', note: '每月自動續訂，隨時可以取消。' },
  yearly: { per: '/ 年', note: '每年自動續訂，隨時可以取消。' },
}

const BUTTON_TEXT: Record<Exclude<CardAction, 'subscribe' | 'login'>, string> = {
  subscribed: '已訂閱',
  soon: '即將開放訂閱',
  wait: '讀取中…',
  error: '價格暫時無法顯示',
}

/** 要更換的方案與試算結果;preview 是 null 代表還在試算 */
interface PendingChange {
  tier: PaidTier
  priceId: string
  label: string
  preview: PlanChangePreview | null
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/** 方案包含的課程階段;badge 標出登入後才免費這類條件 */
function Stages({ levels, showAccess, lead }: { levels: typeof FREE_LEVELS; showAccess?: boolean; lead?: string }) {
  return (
    <ul className={styles.features}>
      {lead && (
        <li>
          <Check />
          <span>{lead}</span>
        </li>
      )}
      {levels.map((level) => (
        <li key={level.id}>
          <Check />
          <span>{stageLabel(level)}</span>
          {showAccess && level.access === 'login-free' && <span className={styles.stageNote}>{ACCESS_LABEL[level.access]}</span>}
        </li>
      ))}
    </ul>
  )
}

export function PricingPage() {
  const { paddle, priceIds, prices, status, checkoutFailed, checkoutCompleted, clearCheckoutError } = usePaddle()
  const { status: authStatus, user } = useAuth()
  /** 目前的方案;null = 還不知道(不能讓人重複訂閱) */
  const [plan, setPlan] = useState<PlanMe | null>(null)
  const subscribed = plan ? plan.subscribed : null
  const currentPriceId = plan?.subscription?.priceId
  const notice = subscriptionNotice(plan?.subscription)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [change, setChange] = useState<PendingChange | null>(null)
  /** 已送出更換、正在等 webhook 的價格 */
  const [changingTo, setChangingTo] = useState('')
  const userId = user?.id
  // 從被擋下的課程點進來時,訂閱完成後回到那一頁
  const [params, setParams] = useSearchParams()
  const returnTo = returnPathOf(params.get('next'))
  const navigate = useNavigate()
  // 未登入時按了訂閱:登入後回到這裡,網址帶著選的方案與週期,準備好就直接開啟結帳(只開一次)
  const pendingTier = paidTierOf(params.get('plan'))
  const pendingPeriod = checkoutPeriodOf(params.get('checkout'))
  const [period, setPeriod] = useState<BillingPeriod>(pendingPeriod ?? 'monthly')
  const autoOpened = useRef(false)

  useEffect(() => {
    if (!checkoutCompleted || !subscribed || !returnTo) return
    paddle?.Checkout.close()
    navigate(returnTo, { replace: true })
  }, [checkoutCompleted, subscribed, returnTo, paddle, navigate])

  useEffect(() => {
    if (!userId) {
      setPlan(null)
      return
    }
    let cancelled = false
    const load = () =>
      authApi
        .planMe()
        .then((next) => {
          if (!cancelled) setPlan(next)
        })
        .catch(() => {
          /* 維持「不確定」:按鈕停用 */
        })
    void load()
    let polls = 0
    const timer =
      checkoutCompleted || changingTo
        ? window.setInterval(() => {
            polls += 1
            if (polls >= PLAN_POLL_TIMES) window.clearInterval(timer)
            void load()
          }, PLAN_POLL_MS)
        : undefined
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId, checkoutCompleted, changingTo])

  // 換方案的事件到了就停止等待
  useEffect(() => {
    if (changingTo && currentPriceId === changingTo) setChangingTo('')
  }, [changingTo, currentPriceId])

  const openCheckout = async (priceId: string) => {
    if (!paddle || !user) return
    clearCheckoutError()
    setError('')
    setBusy(true)
    try {
      const { sessionId } = await authApi.planCheckout(priceId)
      paddle.Checkout.open({
        transactionId: sessionId,
        customer: { email: user.email },
      })
    } catch {
      setError(CHECKOUT_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const openManage = async (updatePayment = false) => {
    setError('')
    setBusy(true)
    try {
      window.location.assign(manageTarget(await authApi.planManage(), updatePayment))
    } catch {
      setError('無法開啟訂閱管理，請稍後再試。')
    } finally {
      setBusy(false)
    }
  }

  // 換方案先試算差額,確認後才送出
  const startChange = async (tier: PaidTier, priceId: string, label: string) => {
    setError('')
    setChange({ tier, priceId, label, preview: null })
    try {
      const preview = await authApi.planChangePreview(priceId)
      setChange((current) => (current?.priceId === priceId ? { ...current, preview } : current))
    } catch {
      setChange(null)
      setError('無法試算更換方案的金額，請稍後再試。')
    }
  }

  const confirmChange = async () => {
    if (!change) return
    setBusy(true)
    setError('')
    try {
      await authApi.planChange(change.priceId)
      setChangingTo(change.priceId)
      setChange(null)
    } catch {
      setError('無法更換方案，請稍後再試。')
    } finally {
      setBusy(false)
    }
  }

  const cards = PAID_TIERS.map(({ tier, name, includesBasic }) => {
    const ids = priceIds[tier] ?? {}
    const priceId = ids[period]
    const action = cardAction(priceId, !!priceId && !!prices[priceId], status, authStatus, subscribed)
    const saving = yearlySavingPercent(ids.monthly && prices[ids.monthly]?.amount, ids.yearly && prices[ids.yearly]?.amount)
    // 這個方案這個週期還不能訂閱(還沒在 Paddle 設定價格):卡片照常顯示,只有這張卡標示即將開放
    const soon = action === 'soon'
    return { tier, name, includesBasic, priceId, action, saving, soon }
  })
  const periodLabel = (key: BillingPeriod) => BILLING_PERIODS.find((p) => p.key === key)?.label ?? ''
  const tierRank = (tier: string | undefined) => PAID_TIERS.findIndex((t) => t.tier === tier)
  const yearlySaving = Math.max(...cards.map((card) => card.saving))

  useEffect(() => {
    if (!pendingPeriod || autoOpened.current) return
    const card = cards.find((c) => c.tier === (pendingTier ?? 'basic'))
    if (!card) return
    // 已經訂閱或確定無法訂閱時不開,只拿掉網址上的參數
    if (card.action === 'subscribed' || card.action === 'soon') {
      autoOpened.current = true
    } else if (card.action === 'subscribe' && card.priceId && paddle) {
      autoOpened.current = true
      void openCheckout(card.priceId)
    } else {
      return
    }
    setParams(
      (current) => {
        const nextParams = new URLSearchParams(current)
        nextParams.delete('checkout')
        nextParams.delete('plan')
        return nextParams
      },
      { replace: true },
    )
  })

  /** 已訂閱時,這張卡的按鈕:目前方案、換週期、升級或改成較低的方案 */
  const changeButton = (tier: PaidTier, name: string, priceId: string | undefined) => {
    if (!priceId) return null
    if (priceId === currentPriceId) {
      return (
        <button type="button" className={styles.button} disabled>
          目前方案
        </button>
      )
    }
    const sameTier = tier === plan?.currentTier
    const label = sameTier ? `改成${periodLabel(period)}` : tierRank(tier) > tierRank(plan?.currentTier) ? `升級到${name}` : `改成${name}`
    return (
      <button
        type="button"
        className={`${styles.button} ${sameTier ? styles.secondary : ''}`}
        disabled={busy || !!changingTo || !currentPriceId}
        onClick={() => void startChange(tier, priceId, `${name}・${periodLabel(period)}`)}
      >
        {label}
      </button>
    )
  }

  return (
    <SiteLayout title="課程方案">
      <div className={styles.page}>
        <header className={styles.head}>
          <span className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            簡單透明的訂閱方案
          </span>
          <h1>
            先免費開始，
            <br />
            <span className={styles.accent}>準備好了再訂閱。</span>
          </h1>
          <p>訂閱期間可以觀看方案內的所有課程，隨時可以取消。</p>
        </header>

        {subscribed && (
          <section className={styles.status} aria-label="目前的訂閱">
            <p className={styles.success}>
              你目前訂閱
              {PAID_TIERS.find((t) => t.tier === plan?.currentTier)?.name ?? '中'}。
            </p>
            {notice.pastDue ? (
              <p className={styles.warning} role="alert">
                {notice.text}
              </p>
            ) : (
              notice.text && <p className={notice.ending ? styles.ending : styles.note}>{notice.text}</p>
            )}
            {changingTo && <p className={styles.note}>正在更換方案，通常只要幾秒鐘。</p>}
            <div className={styles.actions}>
              {notice.pastDue && (
                <button type="button" className={styles.button} disabled={busy} onClick={() => void openManage(true)}>
                  更新付款方式
                </button>
              )}
              <button type="button" className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void openManage()}>
                管理訂閱
              </button>
              {returnTo && (
                <Link className={styles.button} to={returnTo}>
                  回到剛才的課程 →
                </Link>
              )}
            </div>
          </section>
        )}

        <div className={styles.toggle} role="group" aria-label="計費週期">
          {BILLING_PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
              {p.label}
              {p.key === 'yearly' && yearlySaving > 0 && <span className={styles.save}>省 {yearlySaving}%</span>}
            </button>
          ))}
        </div>

        <div className={styles.plans}>
          <section className={styles.plan} aria-labelledby="plan-free">
            <h2 id="plan-free" className={styles.planName}>
              免費
            </h2>
            <p className={styles.price}>
              <span className={styles.num}>NT$0</span>
            </p>
            <p className={styles.note}>不需要付款，部分課程登入後免費。</p>
            <hr />
            <Stages levels={FREE_LEVELS} showAccess />
            <Link className={`${styles.button} ${styles.secondary}`} to={`${SOFTWARE_TOPIC.path}#map`}>
              從免費課程開始
            </Link>
          </section>

          {cards.map(({ tier, name, includesBasic, priceId, action, saving, soon }) => (
            <section key={tier} className={`${styles.plan} ${styles.paid}`} aria-labelledby={`plan-${tier}`}>
              <h2 id={`plan-${tier}`} className={styles.planName}>
                {name}
              </h2>
              <p className={styles.price}>
                {soon ? (
                  <span className={styles.soon}>即將開放</span>
                ) : (
                  <>
                    <span className={styles.num}>{(priceId && prices[priceId]?.formatted) || '—'}</span>
                    <span className={styles.per}>{PERIOD_TEXT[period].per}</span>
                  </>
                )}
              </p>
              <p className={styles.note}>
                {soon ? '這個方案的價格還在準備中。' : PERIOD_TEXT[period].note}
                {!soon && period === 'yearly' && saving > 0 && <span className={styles.saveNote}>比月繳省 {saving}%</span>}
              </p>
              <hr />
              <Stages levels={TIER_LEVELS[tier]} lead={includesBasic ? '基礎方案的全部課程' : undefined} />
              {change?.tier === tier ? (
                <div className={styles.confirm} role="group" aria-label="確認更換方案">
                  <p>
                    換成{change.label}
                    {change.preview
                      ? change.preview.action === 'unknown'
                        ? '，差額會按剩餘天數計算，金額以收據為準。'
                        : change.preview.amount === '0'
                          ? '，不需要補差額。'
                          : change.preview.action === 'charge'
                            ? `，今天會按比例補收 ${formatAmount(change.preview.amount, change.preview.currency)}。`
                            : `，差額 ${formatAmount(change.preview.amount, change.preview.currency)} 會折抵之後的扣款。`
                      : '，正在試算金額…'}
                  </p>
                  {notice.ending && <p className={styles.confirmNote}>更換後會取消原本排定的結束，繼續自動續訂。</p>}
                  <div className={styles.actions}>
                    <button type="button" className={styles.button} disabled={busy || !change.preview} onClick={() => void confirmChange()}>
                      確認更換
                    </button>
                    <button type="button" className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => setChange(null)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : subscribed && (action === 'subscribed' || action === 'subscribe') ? (
                changeButton(tier, name, priceId)
              ) : action === 'login' ? (
                <Link className={styles.button} to={loginHref(pricingHref(returnTo, { tier, period }))}>
                  登入後訂閱
                </Link>
              ) : action === 'subscribe' ? (
                <button type="button" className={styles.button} disabled={busy || !priceId} onClick={() => priceId && void openCheckout(priceId)}>
                  訂閱{name}
                </button>
              ) : (
                <button type="button" className={styles.button} disabled>
                  {BUTTON_TEXT[action]}
                </button>
              )}
            </section>
          ))}
        </div>

        {checkoutCompleted && !subscribed && <p className={styles.footNote}>付款完成，正在開通，通常只要幾秒鐘。</p>}
        {(error || checkoutFailed) && (
          <p className={styles.error} role="alert">
            {error || CHECKOUT_ERROR}
          </p>
        )}

        <p className={styles.footNote}>
          價格依所在地區顯示，實際金額、稅額與續訂條件會在結帳前列出。訂閱會自動續訂，直到你取消為止；每次付款後 {REFUND_DAYS}{' '}
          天內可申請全額退款。升級或改方案時，差額會按剩餘天數計算。
          <br />
          訂單由 Paddle 處理。訂閱即表示您同意<Link to="/terms">服務條款</Link>與<Link to="/refund">退款政策</Link>。
        </p>
      </div>
    </SiteLayout>
  )
}
