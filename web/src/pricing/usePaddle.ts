import type { Paddle } from '@paddle/paddle-js'
import { useEffect, useState } from 'react'
import { authApi, type PlanPrice } from '../auth/api'
import { type PaidTier, type PriceStatus } from './plans'

/** 方案 → 計費週期 → 價格 ID */
export type PriceIds = Partial<Record<PaidTier, Partial<Record<PlanPrice['period'], string>>>>

/** Paddle 依買家地區算出的價格:formatted 直接顯示,amount 是最小單位(算年繳省多少用) */
export interface PriceInfo {
  formatted: string
  amount: string
}

// Paddle 的環境與 client token 由後端提供,不必在 build 時設定;沒有 token 或沒有價格時完全不載入 Paddle.js。
// 不傳 address:由 Paddle 依 IP 判斷地區,顯示的幣別和稅額才會和結帳時一致。
export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [priceIds, setPriceIds] = useState<PriceIds>({})
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [status, setStatus] = useState<PriceStatus>('loading')
  const [checkoutFailed, setCheckoutFailed] = useState(false)
  const [checkoutCompleted, setCheckoutCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .plans()
      .then(async ({ plans, client }) => {
        const planPrices = plans.flatMap((plan) => plan.prices ?? [])
        const items = planPrices.map((price) => ({ priceId: price.id, quantity: 1 }))
        if (cancelled) return
        if (items.length === 0 || !client?.token) {
          setStatus('unavailable')
          return
        }
        const { initializePaddle } = await import('@paddle/paddle-js')
        const instance = await initializePaddle({
          token: client.token,
          environment: client.environment === 'production' ? 'production' : 'sandbox',
          eventCallback: (event) => {
            if (String(event.name) === 'checkout.error') setCheckoutFailed(true)
            if (String(event.name) === 'checkout.completed') setCheckoutCompleted(true)
          },
        })
        if (!instance) throw new Error('Paddle.js 初始化失敗')
        // 每個價格各自試算:某個價格在 Paddle 還沒設定好(不存在、已封存)時,只有那個方案顯示即將開放,其他照常
        const results = await Promise.allSettled(items.map((item) => instance.PricePreview({ items: [item] })))
        if (cancelled) return
        const lineItems = results.flatMap((result) => (result.status === 'fulfilled' ? result.value.data.details.lineItems : []))
        if (lineItems.length === 0) throw new Error('Paddle 沒有回傳任何價格')
        const ids: PriceIds = {}
        for (const plan of plans) {
          if (plan.tier !== 'basic' && plan.tier !== 'advanced') continue
          ids[plan.tier] = Object.fromEntries((plan.prices ?? []).map((price) => [price.period, price.id]))
        }
        setPriceIds(ids)
        // formattedTotals 已含幣別符號與千分位,直接顯示,不要再格式化。
        setPrices(
          Object.fromEntries(
            lineItems.map((item) => [item.price.id, { formatted: item.formattedTotals.total, amount: item.totals.total }]),
          ),
        )
        setPaddle(instance)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { paddle, priceIds, prices, status, checkoutFailed, checkoutCompleted, clearCheckoutError: () => setCheckoutFailed(false) }
}
