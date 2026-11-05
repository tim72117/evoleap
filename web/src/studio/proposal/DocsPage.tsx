import { DocList } from '../docs/DocPage'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

export function DocsPage() {
  return (
    <ProposalLayout title="文件" footer="研究文章與規格文件">
      <h1>文件</h1>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <DocList />
        </div>
      </section>
    </ProposalLayout>
  )
}
