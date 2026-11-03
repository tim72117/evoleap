import { TierOutline } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'

export function LifeToolsPage() {
  return (
    <ProposalLayout title="L1 生活小工具" footer="資料：src/studio/proposal/basicsData.ts、src/content/l1ToolsLessons.ts">
      <h1>L1 · 生活小工具</h1>
      <TierOutline tier="L1T" />
    </ProposalLayout>
  )
}
