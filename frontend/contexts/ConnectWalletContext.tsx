import { ConnectWalletModal } from "@/components/ConnectWalletModal"
import { createContext, useCallback, useState } from "react"

export interface ConnectWalletContextType {
  showWalletModal: () => void
  hideWalletModal: () => void
}

export const ConnectWalletContext = createContext<ConnectWalletContextType | undefined>(undefined)

interface ConnectWalletProviderProps {
  children: React.ReactNode
}

export const ConnectWalletProvider: React.FC<ConnectWalletProviderProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const showWalletModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const hideWalletModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  return (
    <ConnectWalletContext.Provider value={{ showWalletModal, hideWalletModal }}>
      {children}
      <ConnectWalletModal open={isModalOpen} onCancel={hideWalletModal} />
    </ConnectWalletContext.Provider>
  )
}
