/** 單色鎖頭(顏色跟著 currentColor);label 給滑鼠提示與螢幕閱讀器 */
export function LockIcon({ label, className }: { label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} title={label} className={className} style={{ display: 'inline-flex', color: 'var(--site-muted)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  )
}
