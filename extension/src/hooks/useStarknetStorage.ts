import { useState, useEffect } from 'react'

const useStarknetStorage = () => {
  const [walletData, setWalletData] = useState({ wallet: null, address: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load wallet connection details from storage when component mounts
  useEffect(() => {
    loadWalletData()
  }, [])

  const loadWalletData = async () => {
    try {
      setIsLoading(true)
      const result = await chrome.storage.local.get('starknetWallet')
      setWalletData(result.starknetWallet || null)
      setIsLoading(false)
    } catch (err) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  // Function to save wallet connection details to chrome.storage.local
  const saveWalletData = async (data) => {
    try {
      await chrome.storage.local.set({ starknetWallet: data })
      setWalletData(data)
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  // Function to clear wallet connection from storage
  const disconnectWallet = async () => {
    try {
      await chrome.storage.local.remove('starknetWallet')
      setWalletData(null)
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  return {
    walletData,
    isLoading,
    error,
    saveWalletData,
    disconnectWallet,
  }
}

export default useStarknetStorage
