import React, { useState } from 'react'
import { useAccount } from '@starknet-react/core'
import Header from './Header'
import { AgentView } from './AgentView'

export const ConnectButton = () => {
  const { status } = useAccount()
  const [isShowAgentView, setIsShowAgentView] = useState(false)

  return (
    <>
      <Header isShowAgentView={isShowAgentView} setIsShowAgentView={setIsShowAgentView} />
      {status === 'connected' && isShowAgentView && <AgentView />}
    </>
  )
}
