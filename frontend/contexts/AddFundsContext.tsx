import React, { createContext, useState, useCallback } from 'react'
import { AddFundsModal } from '@/components/AddFundsModal'

export interface AddFundsContextType {
  showAddFundsModal: () => void
  hideAddFundsModal: () => void
}

export const AddFundsContext = createContext<AddFundsContextType | undefined>(undefined)

interface AddFundsProviderProps {
  children: React.ReactNode
}

export const AddFundsProvider: React.FC<AddFundsProviderProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const showAddFundsModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const hideAddFundsModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  return (
    <AddFundsContext.Provider value={{ showAddFundsModal, hideAddFundsModal }}>
      {children}
      <AddFundsModal open={isModalOpen} onCancel={hideAddFundsModal} />
    </AddFundsContext.Provider>
  )
}
