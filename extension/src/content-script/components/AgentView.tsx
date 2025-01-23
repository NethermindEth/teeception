import { useState } from 'react'
import ActiveAgents from './ActiveAgents'
import LaunchAgent from './LaunchAgent'
import { Leaderboard } from './Leaderboard'

export enum AGENT_VIEWS {
  'ACTIVE_AGENTS',
  'LAUNCH_AGENT',
  'LEADERBOARD',
}
export const AgentView = () => {
  const [currentView, setCurrentView] = useState<AGENT_VIEWS>(AGENT_VIEWS.ACTIVE_AGENTS)

  return (
    <div className="p-6 text-white bg-black w-[500px] fixed right-0 top-10 h-[800px] z-50">
      {currentView === AGENT_VIEWS.ACTIVE_AGENTS && (
        <ActiveAgents setCurrentView={setCurrentView} />
      )}
      {currentView === AGENT_VIEWS.LAUNCH_AGENT && <LaunchAgent setCurrentView={setCurrentView} />}
      {currentView === AGENT_VIEWS.LEADERBOARD && (
        <Leaderboard setCurrentView={setCurrentView} />
      )}
    </div>
  )
}
