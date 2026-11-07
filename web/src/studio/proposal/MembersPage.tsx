import { AdminConsole } from '../../admin/AdminPage'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 研發基地的「會員」標籤:原本的管理後台(/admin 會轉到這裡)。會員、播放進度與訪客上課紀錄的概況,
// 資料來自 /api/admin/*(只有管理員看得到;本機 -open-studio 時不檢查)。內容元件在 src/admin/AdminPage.tsx。

export function MembersPage() {
  return (
    <ProposalLayout title="會員" footer="資料來源：/api/admin/overview、/api/admin/users（即時）">
      <h1>會員</h1>
      <p className={ui.lead}>會員數、各課的學習與訪客上課情形、會員列表。訪客紀錄保存 180 天。</p>
      <AdminConsole />
    </ProposalLayout>
  )
}
