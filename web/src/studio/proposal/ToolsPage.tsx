import { TierOutline } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'

export function ToolsPage() {
  return (
    <ProposalLayout title="L0 AI 工具介紹" footer="資料：src/studio/proposal/basicsData.ts、src/content/l0Lessons.ts">
      <h1>L0 · AI 工具介紹</h1>
      <TierOutline tier="L0" />
    </ProposalLayout>
  )
}
