import type { JSX } from 'react'
import { InteractiveScenePage } from '../interactive/InteractiveScenePage'
import { AdvancedPage } from './AdvancedPage'
import { AiToolsPage } from './AiToolsPage'
import { CoverPage } from './CoverPage'
import { FieldsPage } from './FieldsPage'
import { L1IdeasPage } from './L1IdeasPage'
import { LifeToolsPage } from './LifeToolsPage'
import { McpPage } from './McpPage'
import { MemberPage } from './MemberPage'
import { ProposalIndexPage } from './ProposalIndexPage'
import { StructurePage } from './StructurePage'
import { ToolsPage } from './ToolsPage'
import { VibeCodingPage } from './VibeCodingPage'
import { VisualsPage } from './VisualsPage'
import { VisualsPreviewPage } from './VisualsPreviewPage'

// 依課程地圖（src/content/levels.ts 的 LEVELS）分等級：
// L0 tools、L1 ai-tools／life-tools（兩門並列）／l1-ideas（構想區）、L2 vibe-coding、L3 ai-agent/*、L4 advanced；跨等級構想 mcp、member、visuals（含即時教學畫面預覽 visuals/preview）、interactive、interactive/l0-claude、interactive/l0-claude-stage（互動教學場景試做）。
export const proposalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/proposal', element: <ProposalIndexPage /> },
  { path: '/proposal/tools', element: <ToolsPage /> },
  { path: '/proposal/ai-tools', element: <AiToolsPage /> },
  { path: '/proposal/life-tools', element: <LifeToolsPage /> },
  { path: '/proposal/l1-ideas', element: <L1IdeasPage /> },
  { path: '/proposal/vibe-coding', element: <VibeCodingPage /> },
  { path: '/proposal/ai-agent/fields', element: <FieldsPage /> },
  { path: '/proposal/ai-agent/structure', element: <StructurePage /> },
  { path: '/proposal/ai-agent/cover', element: <CoverPage /> },
  { path: '/proposal/advanced', element: <AdvancedPage /> },
  { path: '/proposal/mcp', element: <McpPage /> },
  { path: '/proposal/member', element: <MemberPage /> },
  { path: '/proposal/visuals', element: <VisualsPage /> },
  { path: '/proposal/visuals/preview', element: <VisualsPreviewPage /> },
  { path: '/proposal/interactive', element: <InteractiveScenePage key="bakery" script="lab/interactive-bakery.json" pageTitle="互動教學場景" /> },
  { path: '/proposal/interactive/l0-claude', element: <InteractiveScenePage key="l0-claude" script="lab/interactive-l0-claude.json" pageTitle="互動場景：L0 對 Claude 下指令" /> },
  { path: '/proposal/interactive/l0-claude-stage', element: <InteractiveScenePage key="l0-claude-stage" script="lab/interactive-l0-claude.json" pageTitle="互動場景：把演員推到主畫面" interaction="stage" /> },
]
