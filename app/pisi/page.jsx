import WorkspaceClient from './components/workspace-client'
import './pisi.css'
import { isAgenticWorkspaceAvailable, isAgentWebResearchAvailable } from '../../lib/deployment/agentic-availability'

export const dynamic = 'force-dynamic'

export default function PisiPage() {
  return <WorkspaceClient agenticAvailable={isAgenticWorkspaceAvailable()} webResearchAvailable={isAgentWebResearchAvailable()} />
}
