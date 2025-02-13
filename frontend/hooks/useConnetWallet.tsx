import { ConnectWalletContext, ConnectWalletContextType } from '@/contexts/ConnectWalletContext'
import { useContext } from 'react'

export const useConnectWallet = (): ConnectWalletContextType => {
  const context = useContext(ConnectWalletContext)
  if (context === undefined) {
    throw new Error('useAddFunds must be used within an AddFundsProvider')
  }
  return context
}
