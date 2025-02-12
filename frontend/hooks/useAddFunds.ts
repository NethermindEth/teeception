import { AddFundsContext, AddFundsContextType } from '@/contexts/AddFundsContext'
import { useContext } from 'react'

export const useAddFunds = (): AddFundsContextType => {
  const context = useContext(AddFundsContext)
  if (context === undefined) {
    throw new Error('useAddFunds must be used within an AddFundsProvider')
  }
  return context
}
