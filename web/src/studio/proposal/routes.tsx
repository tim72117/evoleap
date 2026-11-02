import type { JSX } from 'react'
import { AdvancedPage } from './AdvancedPage'
import { AiToolsPage } from './AiToolsPage'
import { CoverPage } from './CoverPage'
import { FieldsPage } from './FieldsPage'
import { McpPage } from './McpPage'
import { ProposalIndexPage } from './ProposalIndexPage'
import { StructurePage } from './StructurePage'
import { ToolsPage } from './ToolsPage'
import { VibeCodingPage } from './VibeCodingPage'
import { VisualsPage } from './VisualsPage'
import { VisualsPreviewPage } from './VisualsPreviewPage'

// 依課程地圖（src/content/levels.ts 的 LEVELS）分等級：
// L0 tools、L1 ai-tools、L2 vibe-coding、L3 ai-agent/*、L4 advanced；跨等級構想 mcp、visuals（含即時教學畫面預覽 visuals/preview）。
export const proposalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/proposal', element: <ProposalIndexPage /> },
  { path: '/proposal/tools', element: <ToolsPage /> },
  { path: '/proposal/ai-tools', element: <AiToolsPage /> },
  { path: '/proposal/vibe-coding', element: <VibeCodingPage /> },
  { path: '/proposal/ai-agent/fields', element: <FieldsPage /> },
  { path: '/proposal/ai-agent/structure', element: <StructurePage /> },
  { path: '/proposal/ai-agent/cover', element: <CoverPage /> },
  { path: '/proposal/advanced', element: <AdvancedPage /> },
  { path: '/proposal/mcp', element: <McpPage /> },
  { path: '/proposal/visuals', element: <VisualsPage /> },
  { path: '/proposal/visuals/preview', element: <VisualsPreviewPage /> },
]
