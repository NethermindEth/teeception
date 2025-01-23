import { AGENT_VIEWS } from './AgentView'

export const Leaderboard = ({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) => {
  return <div className="h-full flex text-center items-center">Leaderboard</div>
}
