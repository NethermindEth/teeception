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
}

export const AgentView = ({ isShowAgentView }: AgentViewProps) => {
  const [currentView, setCurrentView] = useState<AGENT_VIEWS>(AGENT_VIEWS.ACTIVE_AGENTS)

  return (
    <div 
      className={`
        overflow-hidden transition-all duration-300 ease-in-out text-white
        ${isShowAgentView ? 'max-h-[800px] opacity-100 visible' : 'max-h-0 opacity-0 invisible'}
      `}
    >
      <div className="px-5 pt-4 border-t border-[#2F3336]">
        <div className={isShowAgentView ? 'block' : 'hidden'}>
          {currentView === AGENT_VIEWS.ACTIVE_AGENTS && (
            <ActiveAgents setCurrentView={setCurrentView} />
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
