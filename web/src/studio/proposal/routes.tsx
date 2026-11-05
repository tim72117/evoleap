import type { JSX } from 'react'
import { ActorsPage } from '../actors/ActorsPage'
import { InteractiveScenePage } from '../interactive/InteractiveScenePage'
import { ActorInteractionPage } from './ActorInteractionPage'
import { AdvancedPage } from './AdvancedPage'
import { AiTipsPage } from './AiTipsPage'
import { AiToolsPage } from './AiToolsPage'
import { CoverPage } from './CoverPage'
import { FieldsPage } from './FieldsPage'
import { L1IdeasPage } from './L1IdeasPage'
import { LifeToolsPage } from './LifeToolsPage'
import { McpPage } from './McpPage'
import { MemberPage } from './MemberPage'
import { NewsFeedPage } from './NewsFeedPage'
import { ProposalIndexPage } from './ProposalIndexPage'
import { ResourcesPage } from './ResourcesPage'
import { StructurePage } from './StructurePage'
import { TodoPage } from './TodoPage'
import { ToolsPage } from './ToolsPage'
import { VibeCodingPage } from './VibeCodingPage'
import { VisualsPage } from './VisualsPage'

// 依課程地圖（src/content/levels.ts 的 LEVELS）分等級：
// L0 tools、L1 ai-tools／life-tools（兩門並列）／l1-ideas（構想區）、L2 vibe-coding、L3 ai-agent/*、L4 advanced；跨等級構想 mcp、member、resources、news-feed、ai-tips、visuals、actor-interaction（演員互動：構想、showcase 演員展示、scene 互動教學場景、push 把演員推到主畫面、static 靜態演員）。
export const proposalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/studio', element: <ProposalIndexPage /> },
  { path: '/studio/todo', element: <TodoPage /> },
  { path: '/studio/tools', element: <ToolsPage /> },
  { path: '/studio/ai-tools', element: <AiToolsPage /> },
  { path: '/studio/life-tools', element: <LifeToolsPage /> },
  { path: '/studio/l1-ideas', element: <L1IdeasPage /> },
  { path: '/studio/vibe-coding', element: <VibeCodingPage /> },
  { path: '/studio/ai-agent/fields', element: <FieldsPage /> },
  { path: '/studio/ai-agent/structure', element: <StructurePage /> },
  { path: '/studio/ai-agent/cover', element: <CoverPage /> },
  { path: '/studio/advanced', element: <AdvancedPage /> },
  { path: '/studio/mcp', element: <McpPage /> },
  { path: '/studio/member', element: <MemberPage /> },
  { path: '/studio/resources', element: <ResourcesPage /> },
  { path: '/studio/news-feed', element: <NewsFeedPage /> },
  { path: '/studio/actor-interaction', element: <ActorInteractionPage /> },
  { path: '/studio/actor-interaction/showcase', element: <ActorsPage /> },
  { path: '/studio/actor-interaction/scene', element: <InteractiveScenePage key="bakery" script="lab/interactive-bakery.json" pageTitle="互動教學場景" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/actor-interaction/static', element: <InteractiveScenePage key="actor-static" script="lab/interactive-l0-claude.json" pageTitle="互動場景：靜態演員" interaction="static" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/actor-interaction/push', element: <InteractiveScenePage key="actor-push" script="lab/interactive-l0-claude.json" pageTitle="互動場景：把演員推到主畫面" interaction="stage" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/ai-tips', element: <AiTipsPage /> },
  { path: '/studio/visuals', element: <VisualsPage /> },
]
