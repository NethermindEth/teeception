import { useState } from 'react'
import ActiveAgents from './AgentList'
import LaunchAgent from './LaunchAgent'
import { Leaderboard } from './Leaderboard'

export enum AGENT_VIEWS {
  'ACTIVE_AGENTS',
  'LAUNCH_AGENT',
  'LEADERBOARD',
}

interface AgentViewProps {
  isShowAgentView: boolean
  setIsShowAgentView: (show: boolean) => void
}

export const AgentView = ({ isShowAgentView, setIsShowAgentView }: AgentViewProps) => {
  const [currentView, setCurrentView] = useState<AGENT_VIEWS>(AGENT_VIEWS.ACTIVE_AGENTS)

  return (
    <div 
    className={`
       transition-all duration-300 ease-in-out text-white
      ${isShowAgentView ? 'max-h-[calc(100vh-120px)] overflow-auto opacity-100 visible' : 'max-h-0 opacity-0 invisible overflow-hidden'}
    `}
    >
      <div className="px-5 pt-4 border-t border-[#2F3336]">
        <div className={isShowAgentView ? 'block' : 'hidden'}>
          {currentView === AGENT_VIEWS.ACTIVE_AGENTS && (
            <ActiveAgents setCurrentView={setCurrentView} setIsShowAgentView={setIsShowAgentView} />
          )}
          {currentView === AGENT_VIEWS.LAUNCH_AGENT && <LaunchAgent setCurrentView={setCurrentView} />}
          {currentView === AGENT_VIEWS.LEADERBOARD && (
            <Leaderboard setCurrentView={setCurrentView} />
          )}
        </div>
      </div>
    </div>
  )
}
