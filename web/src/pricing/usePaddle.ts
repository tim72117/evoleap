import type { Paddle } from '@paddle/paddle-js'
import { useEffect, useState } from 'react'
import { authApi, type PlanPrice } from '../auth/api'
import { type PriceStatus } from './plans'

// Paddle 的環境與 client token 由後端提供,不必在 build 時設定;沒有 token 或沒有價格時完全不載入 Paddle.js。
// 不傳 address:由 Paddle 依 IP 判斷地區,顯示的幣別和稅額才會和結帳時一致。
export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [priceIds, setPriceIds] = useState<Partial<Record<PlanPrice['period'], string>>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
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
        const response = await instance.PricePreview({ items })
        if (cancelled) return
        setPriceIds(Object.fromEntries(planPrices.map((price) => [price.period, price.id])))
        // formattedTotals 已含幣別符號與千分位,直接顯示,不要再格式化。
        setPrices(Object.fromEntries(response.data.details.lineItems.map((item) => [item.price.id, item.formattedTotals.total])))
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
