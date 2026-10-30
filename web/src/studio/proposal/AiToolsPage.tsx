import { TierOutline } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'

export function AiToolsPage() {
  return (
    <ProposalLayout title="L1 AI 工具入門" footer="資料：src/studio/proposal/basicsData.ts、src/content/l1Lessons.ts">
      <h1>L1 · AI 工具入門</h1>
      <TierOutline tier="L1" />
    </ProposalLayout>
  )
}
