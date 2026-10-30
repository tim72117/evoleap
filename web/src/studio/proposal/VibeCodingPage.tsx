import { TierOutline } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'

export function VibeCodingPage() {
  return (
    <ProposalLayout title="L2 Vibe Coding 入門" footer="資料：src/studio/proposal/basicsData.ts">
      <h1>L2 · Vibe Coding 入門：工具與環境從零開始</h1>
      <TierOutline tier="L2" />
    </ProposalLayout>
  )
}
