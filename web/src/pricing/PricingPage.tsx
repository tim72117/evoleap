import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, type PlanMe } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { ACCESS_LABEL } from '../content/levels'
import { SOFTWARE_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { BILLING_PERIODS, FREE_LEVELS, manageTarget, subscribeAction, subscriptionNotice, SUBSCRIPTION_LEVELS } from './plans'
import styles from './PricingPage.module.css'
import { usePaddle } from './usePaddle'

// 付款模式是訂閱制,分月繳與年繳。開通只看後端收到的 webhook,不看這裡結帳的結果,所以付款後要重新確認。
const PLAN_POLL_MS = 3000
const PLAN_POLL_TIMES = 6

const CHECKOUT_ERROR = '結帳無法開始，請稍後再試。'

export function PricingPage() {
  const { paddle, priceIds, prices, status, checkoutFailed, checkoutCompleted, clearCheckoutError } = usePaddle()
  const { status: authStatus, user } = useAuth()
  /** 目前的方案;null = 還不知道(不能讓人重複訂閱) */
  const [plan, setPlan] = useState<PlanMe | null>(null)
  const subscribed = plan ? plan.subscribed : null
  const notice = subscriptionNotice(plan?.subscription)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const userId = user?.id

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
    const timer = checkoutCompleted
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
  }, [userId, checkoutCompleted])

  const openCheckout = async (priceId: string) => {
    if (!paddle || !user) return
    clearCheckoutError()
    setError('')
    setBusy(true)
    try {
      const { sessionId } = await authApi.planCheckout(priceId)
      paddle.Checkout.open({ transactionId: sessionId, customer: { email: user.email } })
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

  const periods = BILLING_PERIODS.flatMap((period) => {
    const priceId = priceIds[period.key]
    return priceId ? [{ ...period, priceId, action: subscribeAction(priceId, status, authStatus, subscribed) }] : []
  })

  return (
    <SiteLayout title="課程方案">
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>課程方案</h1>
          <p>先從免費課程開始，確定適合自己，再訂閱繼續往下學。</p>
        </header>

        <section className={styles.section} aria-labelledby="pricing-free">
          <h2 id="pricing-free">免費課程</h2>
          <div className={styles.freePlan}>
            <div>
              <p className={styles.price}>免費</p>
              <p className={styles.note}>部分課程需要先登入。</p>
              <Link className={styles.primary} to={`${SOFTWARE_TOPIC.path}#map`}>
                從免費課程開始
              </Link>
            </div>
            <ul className={styles.freeList}>
              {FREE_LEVELS.map((level) => (
                <li key={level.id}>
                  <Link to={level.link ?? SOFTWARE_TOPIC.path}>{level.title}</Link>
                  <span className={styles.badge}>{ACCESS_LABEL[level.access]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="pricing-subscription">
          <h2 id="pricing-subscription">訂閱方案</h2>
          <div className={styles.freePlan}>
            <div>
              <p className={styles.price}>訂閱</p>
              <p className={styles.note}>提供月繳與年繳。訂閱期間可以觀看所有訂閱課程，包括期間新增的課程。可以隨時取消。</p>
              {subscribed ? (
                <>
                  <p className={styles.success}>你已經訂閱了。</p>
                  {notice.pastDue ? (
                    <p className={styles.warning} role="alert">
                      {notice.text}
                    </p>
                  ) : (
                    notice.text && <p className={styles.note}>{notice.text}</p>
                  )}
                  <div className={styles.periods}>
                    {notice.pastDue && (
                      <button type="button" className={styles.primary} disabled={busy} onClick={() => void openManage(true)}>
                        更新付款方式
                      </button>
                    )}
                    <button type="button" className={styles.primary} disabled={busy} onClick={() => void openManage()}>
                      管理訂閱
                    </button>
                  </div>
                </>
              ) : periods.length === 0 ? (
                <button type="button" className={styles.primary} disabled>
                  {status === 'loading' ? '讀取價格中…' : status === 'error' ? '價格暫時無法顯示' : '即將開放訂閱'}
                </button>
              ) : (
                <div className={styles.periods}>
                  {periods.map(({ key, label, priceId, action }) => {
                    const text = `${label} ${prices[priceId] ?? ''}`.trim()
                    if (action === 'login') {
                      return (
                        <Link key={key} className={styles.primary} to={loginHref('/pricing')}>
                          登入後訂閱{text}
                        </Link>
                      )
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        className={styles.primary}
                        disabled={action !== 'subscribe' || busy}
                        onClick={() => void openCheckout(priceId)}
                      >
                        {text}
                      </button>
                    )
                  })}
                </div>
              )}
              {checkoutCompleted && !subscribed && <p className={styles.note}>付款完成，正在開通，通常只要幾秒鐘。</p>}
              {(error || checkoutFailed) && (
                <p className={styles.error} role="alert">
                  {error || CHECKOUT_ERROR}
                </p>
              )}
            </div>
            <ul className={styles.freeList}>
              {SUBSCRIPTION_LEVELS.map((level) => (
                <li key={level.id}>
                  <Link to={level.link ?? SOFTWARE_TOPIC.path}>{level.title}</Link>
                  {level.status === 'planned' && <span className={styles.badge}>規劃中</span>}
                </li>
              ))}
            </ul>
          </div>
          <p className={styles.note}>價格與續訂條件會在結帳前清楚說明，訂閱會自動續訂，直到你取消為止。</p>
          <p className={styles.note}>
            訂單由 Paddle 處理。訂閱即表示您同意<Link to="/terms">服務條款</Link>與<Link to="/refund">退款政策</Link>。
          </p>
        </section>
      </div>
    </SiteLayout>
  )
}
