import { Link } from 'react-router-dom'
import { KidsPlayer } from '../../kids/KidsPlayer'
import { InteractiveScenePage } from '../interactive/InteractiveScenePage'
import type { LabTrial } from './labTrials'
import { ProposalLayout } from './ProposalLayout'

// 其他課程的試做頁:一般課用互動課程頁的播放器(靜態互動:互動點寫了 spots 就直接點演員,沒寫照舊用側欄),兒童課用兒童版播放器。
export function LabTrialPage({ trial }: { trial: LabTrial }) {
  const title = `${trial.course} ${trial.code} 試做`
  if (trial.player !== 'kids') return <InteractiveScenePage key={trial.path} script={trial.script} pageTitle={title} interaction="static" back={trial.back} />
  return (
    <ProposalLayout title={title} footer={`試做 · 腳本：src/content/live/${trial.script}`}>
      <p>
        <Link to={trial.back.to}>{trial.back.label}</Link>
      </p>
      <h1>
        {trial.code}　{trial.title}
      </h1>
      <KidsPlayer key={trial.path} script={trial.script} scrub />
    </ProposalLayout>
  )
}
