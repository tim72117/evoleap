import type { JSX } from 'react'
import { HomePage } from './HomePage'
import { ClaudeCodeTopicPage } from './ClaudeCodeTopicPage'
import { AiAppsTopicPage, SoftwareTopicPage } from './SoftwareTopicPage'
import { AI_APPS_TOPIC, CLAUDE_CODE_TOPIC, SOFTWARE_TOPIC } from '../content/topics'

export const homeRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/', element: <HomePage /> },
  { path: SOFTWARE_TOPIC.path, element: <SoftwareTopicPage /> },
  { path: AI_APPS_TOPIC.path, element: <AiAppsTopicPage /> },
  { path: CLAUDE_CODE_TOPIC.path, element: <ClaudeCodeTopicPage /> },
]
