import type { JSX } from 'react'
import { AdvancedPage } from './AdvancedPage'
import { AiToolsPage } from './AiToolsPage'
import { CoverPage } from './CoverPage'
import { FieldsPage } from './FieldsPage'
import { ProposalIndexPage } from './ProposalIndexPage'
import { StructurePage } from './StructurePage'
import { ToolsPage } from './ToolsPage'
import { VibeCodingPage } from './VibeCodingPage'
import { VideoPage } from './VideoPage'

// 依課程地圖（src/content/levels.ts 的 LEVELS）分等級：
// L0 tools、L1 ai-tools、L2 vibe-coding、L3 ai-agent/*、L4 advanced。
export const proposalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/proposal', element: <ProposalIndexPage /> },
  { path: '/proposal/tools', element: <ToolsPage /> },
  { path: '/proposal/ai-tools', element: <AiToolsPage /> },
  { path: '/proposal/vibe-coding', element: <VibeCodingPage /> },
  { path: '/proposal/ai-agent/fields', element: <FieldsPage /> },
  { path: '/proposal/ai-agent/structure', element: <StructurePage /> },
  { path: '/proposal/ai-agent/cover', element: <CoverPage /> },
  { path: '/proposal/ai-agent/video', element: <VideoPage /> },
  { path: '/proposal/advanced', element: <AdvancedPage /> },
]
