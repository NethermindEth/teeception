import { SingleAgentDetails } from '@/hooks/useAgent'
import CountdownTimer from './CountdownTimer'
import { AgentStatus } from '@/types'

export const StatusDisplay = ({
  agent,
  status,
}: {
  agent: SingleAgentDetails
  status: AgentStatus
}) => {
  switch (status) {
    case AgentStatus.ACTIVE:
      return (
        <div className="text-3xl font-bold text-white min-w-[240px] text-center">
          <CountdownTimer
            endTime={Number(agent.endTime)}
            className="bg-transparent"
            size="lg"
          />
        </div>
      )
    case AgentStatus.UNDEFEATED:
      return (
        <div className="text-3xl font-bold tracking-wider bg-[#1388D5]/20 text-[#1388D5] px-8 py-4 rounded-lg mb-12">
          UNDEFEATED
        </div>
      )
    default:
      return (
        <div className="text-3xl font-bold tracking-wider bg-[#FF3F26]/20 text-[#FF3F26] px-8 py-4 rounded-lg mb-12">
          DEFEATED
        </div>
      )
  }
}
