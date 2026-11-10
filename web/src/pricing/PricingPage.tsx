import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, authApi, type PlanMe } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { ACCESS_LABEL, type CourseLevel } from '../content/levels'
import { SOFTWARE_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { FREE_LEVELS, PLAN_LABEL, safeNext, SUBSCRIPTION_LEVELS } from './plans'
import styles from './PricingPage.module.css'

// 方案頁:廣告方案(免費,看基礎訂閱課程,每課開始前播一段廣告)與訂閱方案(即將開放)。
// 被訂閱課程擋下時會帶 ?next=<那一課>,選好廣告方案就回去。真正的權限由伺服器判定。

export function PricingPage() {
  const { status, user } = useAuth()
  const { pathname, search } = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  /** 目前的方案;null = 還不知道(未登入或還沒查到) */
  const [plan, setPlan] = useState<PlanMe | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const userId = user?.id

  useEffect(() => {
    setPlan(null)
    if (!userId) return
    let cancelled = false
    authApi
      .planMe()
      .then((p) => {
        if (!cancelled) setPlan(p)
      })
      .catch(() => {
        /* 查不到就不顯示目前方案,按鈕仍可以按(選擇廣告方案重複按沒有副作用) */
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const chooseAds = async () => {
    setError('')
    setBusy(true)
    try {
      const p = await authApi.chooseAdsPlan()
      setPlan(p)
      if (next) navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '暫時無法選擇方案，請稍後再試。')
    } finally {
      setBusy(false)
    }
  }

  const onAds = plan?.plan === 'ads'
  const subscribed = plan?.plan === 'subscription'

  return (
    <SiteLayout title="課程方案">
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>課程方案</h1>
          <p>免費課程直接開始；基礎訂閱課程可以選廣告方案免費觀看。</p>
          {plan && <p className={styles.current}>目前方案：{PLAN_LABEL[plan.plan]}</p>}
        </header>

        <section className={styles.plans} aria-label="方案">
          <article className={styles.plan}>
            <h2>廣告方案</h2>
            <p className={styles.price}>免費</p>
            <ul className={styles.points}>
              <li>可以觀看基礎訂閱課程</li>
              <li>每一課開始前播放一段廣告</li>
            </ul>
            <div className={styles.planAction}>
              {status === 'guest' ? (
                <Link className={styles.primary} to={loginHref(pathname + search)}>
                  選擇廣告方案
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={status !== 'user' || busy || onAds || subscribed}
                  onClick={() => void chooseAds()}
                >
                  {onAds ? '目前方案' : status === 'disabled' ? '即將開放' : '選擇廣告方案'}
                </button>
              )}
              {onAds && next && (
                <Link className={styles.secondary} to={next}>
                  回去上課
                </Link>
              )}
            </div>
            {status === 'guest' && <p className={styles.note}>登入後就能選擇。</p>}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </article>

          <article className={styles.plan}>
            <h2>訂閱方案</h2>
            <p className={styles.price}>即將開放</p>
            <ul className={styles.points}>
              <li>全部課程</li>
              <li>免廣告</li>
            </ul>
            <div className={styles.planAction}>
              <button type="button" className={styles.primary} disabled>
                {subscribed ? '目前方案' : '即將開放'}
              </button>
            </div>
          </article>
        </section>

        <section className={styles.section} aria-labelledby="pricing-free">
          <h2 id="pricing-free">免費課程</h2>
          <p className={styles.note}>不用選方案，部分課程要先登入。</p>
          <LevelList levels={FREE_LEVELS} badge={(l) => (l.access === 'login-free' ? '登入後免費' : (ACCESS_LABEL[l.access] ?? '免費'))} />
        </section>

        <section className={styles.section} aria-labelledby="pricing-subscription">
          <h2 id="pricing-subscription">訂閱課程</h2>
          <p className={styles.note}>廣告方案可以觀看基礎訂閱課程；訂閱方案可以觀看全部課程。</p>
          <LevelList levels={SUBSCRIPTION_LEVELS} badge={(l) => (l.status === 'planned' ? '規劃中' : '訂閱')} />
        </section>
      </div>
    </SiteLayout>
  )
}

/** 課程清單:整列都可以點,連到課程頁 */
function LevelList({ levels, badge }: { levels: CourseLevel[]; badge: (level: CourseLevel) => string }) {
  return (
    <ul className={styles.levels}>
      {levels.map((level) => (
        <li key={level.id}>
          <Link className={styles.levelRow} to={level.link ?? SOFTWARE_TOPIC.path}>
            <span className={styles.levelTitle}>
              <span className={styles.levelLabel}>{level.levelLabel}</span>
              {level.title}
            </span>
            <span className={styles.badge}>{badge(level)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
