import React, { useState } from 'react'
import Header from './Header'

export const ConnectButton = () => {
  const [isShowAgentView, setIsShowAgentView] = useState(false)

  return (
    <Header isShowAgentView={isShowAgentView} setIsShowAgentView={setIsShowAgentView} />
  )
}
