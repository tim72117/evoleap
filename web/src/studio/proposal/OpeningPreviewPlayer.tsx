import { useEffect, useRef, useState } from 'react'
import { mountShell } from '../../live/shell'
import { createStage } from '../../live/stage'
import { loadScript } from '../../live/scripts'
import '../../live/shell.css'
import type { CourseLesson } from '../../content/lessonTypes'
import { LivePlayer } from '../../courses/LivePlayer'
import { openingScript } from './openingScript'
import ui from './proposal.module.css'

// 研發頁的情境開場預覽：按下才建立播放器（一頁有很多課，不要一次全部掛上）。
// opening.live 有腳本時播試做動畫，沒有時播字卡簡版；都沒有旁白語音，只有字幕。
export function OpeningPreview({ course }: { course: CourseLesson }) {
  const [on, setOn] = useState(false)
  if (!on)
    return (
      <button type="button" className={ui.copy} onClick={() => setOn(true)}>
        {course.opening.live ? '▶ 播放情境開場（試做動畫）' : '▶ 播放情境開場預覽（簡版）'}
      </button>
    )
  return <OpeningPlayer course={course} />
}

function OpeningPlayer({ course }: { course: CourseLesson }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    const stageEl = document.createElement('div')
    const stage = createStage(stageEl)
    const vp = mountShell(box, { stage: stageEl, title: `${course.id} 情境開場`, globalKeys: false })
    const live = course.opening.live
    Promise.all([live ? loadScript(live) : openingScript(course), document.fonts.ready])
      .then(([script]) => (cancelled ? undefined : stage.load(script)))
      .then(() => {
        if (cancelled) return
        const caps = stage.captions
        vp.update({
          duration: stage.duration,
          renderAt: (ms) => stage.renderAt(ms),
          chapters: stage.chapters,
          captions: (ms) => caps.find((c) => ms >= c.from && ms < c.to)?.text || '',
        })
        vp.play()
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      vp.destroy()
    }
  }, [course])

  return (
    <div className={ui['opening-preview']}>
      <div ref={boxRef} />
      {error && <p role="alert">無法播放：{error}</p>}
    </div>
  )
}

// 課程影片的即時教學畫面預覽(src/content/live/ 底下的腳本):和學員課程頁同一個播放器,有旁白語音,但不記播放進度。
// 按下才建立播放器(一頁有很多課,不要一次全部掛上)。
export function LiveVideoPreview({ script, title }: { script: string; title: string }) {
  const [on, setOn] = useState(false)
  if (!on)
    return (
      <div style={{ marginTop: 8 }}>
        <button type="button" className={ui.copy} onClick={() => setOn(true)}>
          ▶ 播放即時教學畫面
        </button>
      </div>
    )
  return (
    <div className={ui['live-video']}>
      <LivePlayer script={script} title={title} onTime={noop} saveProgress={false} />
    </div>
  )
}

const noop = (): void => {}
