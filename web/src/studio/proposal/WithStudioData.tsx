import type { ReactNode } from 'react'
import { useStudioData } from '../studioData'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 讀研發基地的資料檔(../studioData.ts)再畫頁面:讀到之前、讀不到時,用同樣的版面顯示狀態,讀到後交給 children

type Props<T> = { path: string; title: string; footer: string; children: (data: T) => ReactNode }

export function WithStudioData<T>({ path, title, footer, children }: Props<T>) {
  const { data, error } = useStudioData<T>(path)
  if (data) return <>{children(data)}</>
  return (
    <ProposalLayout title={title} footer={footer}>
      <h1>{title}</h1>
      <p className={error ? ui.note : ui.lead} role="status">
        {error ?? '讀取中…'}
      </p>
    </ProposalLayout>
  )
}
