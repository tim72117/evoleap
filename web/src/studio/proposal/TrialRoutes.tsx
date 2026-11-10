import { useLocation, useParams } from 'react-router-dom'
import { NotFoundPage } from '../../site/NotFoundPage'
import { InteractiveScenePage } from '../interactive/InteractiveScenePage'
import { STUDIO_DATA } from '../studioData'
import { fullItems, fullScriptPath, KIND_LABEL, type FullCourseData, type FullCourseKind } from './fullCourse'
import { LabTrialPage } from './LabTrialPage'
import { trialAt, type LabTrialsData } from './labTrials'
import { WithStudioData } from './WithStudioData'

// 試做頁的路由:清單是研發基地的資料(進資料庫,../studioData.ts),所以不在 build 時逐頁產生路由,開頁時才從清單找。

const FULL_BACK = { to: '/studio/full-course', label: '← 全環節課程清單' }

/** /studio/full-course/:item/:kind,例如 /studio/full-course/17-2/ai:全環節課程清單的一堂試做 */
export function FullTrialRoute() {
  const { item = '', kind = '' } = useParams()
  const code = item.replace('-', '.')
  if (!/^\d+\.\d+$/.test(code) || (kind !== 'know' && kind !== 'ai')) return <NotFoundPage />
  const k = kind as FullCourseKind
  return (
    <WithStudioData<FullCourseData> path={STUDIO_DATA.fullCourse} title="全環節課程試做" footer="腳本：src/content/live/lab/full-course/">
      {(d) => {
        const it = fullItems(d.stages).find((x) => x.code === code)
        if (!it) return <NotFoundPage />
        return (
          <InteractiveScenePage
            key={`full-${code}-${k}`}
            script={fullScriptPath(code, k)}
            pageTitle={`${code} ${it.lesson.title}（${KIND_LABEL[k]}）試做`}
            interaction="static"
            back={FULL_BACK}
          />
        )
      }}
    </WithStudioData>
  )
}

/**
 * 研發基地找不到路由時(StudioApp 的 *):網址是 lab 試做清單裡的一堂就開那一堂(例如 /studio/web-basics/1-3、/studio/kids-web/1-1/live),
 * 不是就顯示找不到頁面。
 */
export function LabTrialOrNotFound() {
  const { pathname } = useLocation()
  if (!pathname.startsWith('/studio/')) return <NotFoundPage />
  return (
    <WithStudioData<LabTrialsData> path={STUDIO_DATA.labTrials} title="課程試做" footer="清單：src/content/live/data/lab-trials.json">
      {(d) => {
        const trial = trialAt(d.trials, pathname)
        return trial ? <LabTrialPage key={trial.path} trial={trial} /> : <NotFoundPage />
      }}
    </WithStudioData>
  )
}
