import type { JSX } from 'react'
import { ActorsPage } from '../actors/ActorsPage'
import { InteractiveScenePage } from '../interactive/InteractiveScenePage'
import { ActorInteractionPage } from './ActorInteractionPage'
import { AdvancedPage } from './AdvancedPage'
import { AiTipsPage } from './AiTipsPage'
import { AiToolsPage } from './AiToolsPage'
import { CoverPage } from './CoverPage'
import { FieldsPage } from './FieldsPage'
import { KidsWebPage } from './KidsWebPage'
import { OpsCoursePage } from './OpsCoursePage'
import { WebBasicsPage } from './WebBasicsPage'
import { KidsLesson01Page } from '../kids/KidsLesson01Page'
import { KidsLesson01LivePage } from '../kids/KidsLesson01LivePage'
import { KidsLesson02LivePage } from '../kids/KidsLesson02LivePage'
import { KidsLesson03LivePage } from '../kids/KidsLesson03LivePage'
import { KidsXrayLivePage } from '../kids/KidsXrayLivePage'
import { L1IdeasPage } from './L1IdeasPage'
import { LifeToolsPage } from './LifeToolsPage'
import { McpPage } from './McpPage'
import { MemberPage } from './MemberPage'
import { NewsFeedPage } from './NewsFeedPage'
import { ExtensionsPage } from './ExtensionsPage'
import { PortraitPage } from './PortraitPage'
import { DocsPage } from './DocsPage'
import { ProposalIndexPage } from './ProposalIndexPage'
import { ResourcesPage } from './ResourcesPage'
import { StructurePage } from './StructurePage'
import { TodoPage } from './TodoPage'
import { ToolsPage } from './ToolsPage'
import { VibeCodingPage } from './VibeCodingPage'
import { VisualsPage } from './VisualsPage'
import { MembersPage } from './MembersPage'

// 依課程地圖（src/content/levels.ts 的 LEVELS）分等級：
// L0 tools、L1 ai-tools／life-tools（兩門並列）／l1-ideas（構想區）、L2 vibe-coding、L3 ai-agent/*、L4 advanced，再接不分等級的課程 ai-tips、kids-web、web-basics；開發 visuals、portrait(直式舞台)、actor-interaction（演員互動：構想、showcase 演員展示、scene 互動教學場景、push 把演員推到主畫面、static 靜態演員）；跨等級構想 mcp、member、resources、news-feed、extensions(延伸課程)。
export const proposalRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/studio', element: <ProposalIndexPage /> },
  { path: '/studio/todo', element: <TodoPage /> },
  { path: '/studio/members', element: <MembersPage /> },
  { path: '/studio/docs', element: <DocsPage /> },
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
  { path: '/studio/extensions', element: <ExtensionsPage /> },
  { path: '/studio/actor-interaction', element: <ActorInteractionPage /> },
  { path: '/studio/actor-interaction/showcase', element: <ActorsPage /> },
  { path: '/studio/actor-interaction/scene', element: <InteractiveScenePage key="bakery" script="lab/interactive-bakery.json" pageTitle="互動教學場景" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/actor-interaction/static', element: <InteractiveScenePage key="actor-static" script="lab/interactive-l0-claude.json" pageTitle="互動場景：靜態演員" interaction="static" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/actor-interaction/push', element: <InteractiveScenePage key="actor-push" script="lab/interactive-l0-claude.json" pageTitle="互動場景：把演員推到主畫面" interaction="stage" back={{ to: '/studio/actor-interaction', label: '← 演員互動' }} /> },
  { path: '/studio/ai-tips', element: <AiTipsPage /> },
  { path: '/studio/kids-web', element: <KidsWebPage /> },
  { path: '/studio/web-basics', element: <WebBasicsPage /> },
  { path: '/studio/ops-course', element: <OpsCoursePage /> },
  // 網頁運作知識的試做:單元 5 的 5.1 開發者工具(序章、1.1、1.2 已是正式課,在 /topics/web),腳本在 content/live/lab/web/
  ...(['5.1'] as const).map((id) => ({
    path: `/studio/web-basics/${id.replace('.', '-')}`,
    element: <InteractiveScenePage key={`web-${id}`} script={`lab/web/${id}.json`} pageTitle={`網頁運作知識 ${id} 試做`} back={{ to: '/studio/web-basics', label: '← 網頁運作知識' }} />,
  })),
  // L2 基礎的試做,腳本在 content/live/lab/vibe-coding/
  ...(['4.1', '4.2', '4.3'] as const).map((id) => ({
    path: `/studio/vibe-coding/${id.replace('.', '-')}`,
    element: <InteractiveScenePage key={`vibe-${id}`} script={`lab/vibe-coding/${id}.json`} pageTitle={`L2 基礎 ${id} 試做`} back={{ to: '/studio/vibe-coding', label: '← L2 Vibe Coding 入門' }} />,
  })),
  { path: '/studio/kids-web/0-1', element: <KidsLesson01Page /> },
  { path: '/studio/kids-web/0-1/live', element: <KidsLesson01LivePage /> },
  { path: '/studio/kids-web/0-2/live', element: <KidsLesson02LivePage /> },
  { path: '/studio/kids-web/0-3/live', element: <KidsLesson03LivePage /> },
  { path: '/studio/kids-web/xray', element: <KidsXrayLivePage /> },
  { path: '/studio/visuals', element: <VisualsPage /> },
  { path: '/studio/portrait', element: <PortraitPage /> },
]
