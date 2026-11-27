import { Component, lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react'

// 頁面裡用到才下載的一小塊(播放器、互動展示):和 lazyPage 的差別是下載中與下載失敗都只影響這一塊,
// 顯示 fallback(通常是插圖或空白),不放整頁的「載入中」、錯誤畫面,也不重新整理頁面。

class PartBoundary extends Component<{ fallback: ReactNode; onFail?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail?.()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPart<C extends ComponentType<any>>(load: () => Promise<C>) {
  const Lazy = lazy(() => load().then((Component) => ({ default: Component })))
  return function LazyPart({ fallback, onFail, ...props }: ComponentProps<C> & { fallback: ReactNode; onFail?: () => void }) {
    const Part = Lazy as unknown as ComponentType<object>
    return (
      <PartBoundary fallback={fallback} onFail={onFail}>
        <Suspense fallback={fallback}>
          <Part {...props} />
        </Suspense>
      </PartBoundary>
    )
  }
}
