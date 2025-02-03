import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Info, AlertCircle, Loader2 } from 'lucide-react'
import { AGENT_VIEWS } from './AgentView'
import { useState, useMemo, useEffect } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'
import { useAccount, useContract, useSendTransaction } from '@starknet-react/core'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { uint256, Contract } from 'starknet'
import { useTokenSupport } from '../hooks/useTokenSupport'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { debug } from '../utils/debug'

interface FormData {
  agentName: string
  feePerMessage: string
  initialBalance: string
  systemPrompt: string
  selectedToken: string
  endTime: string // New field for end time
}

interface FormErrors {
  agentName?: string
  feePerMessage?: string
  initialBalance?: string
  systemPrompt?: string
  selectedToken?: string
  endTime?: string
  submit?: string
}

enum TransactionStep {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export default function LaunchAgent({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) {
  const { account } = useAccount()
  const { address: registryAddress } = useAgentRegistry()
  const { supportedTokens, isLoading: isLoadingSupport } = useTokenSupport()
  
  const [formData, setFormData] = useState<FormData>({
    agentName: '',
    feePerMessage: '',
    initialBalance: '',
    systemPrompt: '',
    selectedToken: Object.keys(ACTIVE_NETWORK.tokens)[0],
    endTime: '',
  })

  const { contract: registry } = useContract({
    address: registryAddress as `0x${string}`,
    abi: TEECEPTION_AGENTREGISTRY_ABI,
  })

  const selectedToken = ACTIVE_NETWORK.tokens[formData.selectedToken]
  const { contract: tokenContract } = useContract({
    address: selectedToken.address as `0x${string}`,
    abi: TEECEPTION_ERC20_ABI,
  })

  const { balance: tokenBalance, isLoading: isLoadingBalance } = useTokenBalance(formData.selectedToken)

  const [errors, setErrors] = useState<FormErrors>({})
  const [transactionStep, setTransactionStep] = useState<TransactionStep>(TransactionStep.IDLE)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)

  // Get supported tokens only
  const supportedTokenList = useMemo(() => {
    return Object.entries(ACTIVE_NETWORK.tokens)
      .filter(([symbol]) => {
        const isSupported = supportedTokens[symbol]?.isSupported
        return isSupported
      })
      .map(([symbol, token]) => ({
        symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        minPromptPrice: supportedTokens[symbol]?.minPromptPrice
      }))
  }, [supportedTokens])

  // Set first supported token as default when loaded
  useEffect(() => {
    if (supportedTokenList.length > 0 && !supportedTokens[formData.selectedToken]?.isSupported) {
      setFormData(prev => ({
        ...prev,
        selectedToken: supportedTokenList[0].symbol
      }))
    }
  }, [supportedTokenList, formData.selectedToken, supportedTokens])

  // Set default end time to 1 year from now
  useEffect(() => {
    const oneYearFromNow = new Date()
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
    setFormData(prev => ({
      ...prev,
      endTime: oneYearFromNow.toISOString().split('T')[0]
    }))
  }, [])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Validate agent name
    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required'
    } else if (formData.agentName.length > 31) {
      newErrors.agentName = 'Agent name must be 31 characters or less'
    }

    const selectedToken = ACTIVE_NETWORK.tokens[formData.selectedToken]
    const tokenSupport = supportedTokens[formData.selectedToken]

    if (!tokenSupport?.isSupported) {
      newErrors.selectedToken = 'Selected token is not supported'
    }

    // Validate fee
    const feeNumber = parseFloat(formData.feePerMessage)
    if (isNaN(feeNumber) || feeNumber < 0) {
      newErrors.feePerMessage = 'Fee must be a positive number'
    } else if (tokenSupport?.minPromptPrice) {
      const feeInSmallestUnit = BigInt(feeNumber * Math.pow(10, selectedToken.decimals))
      if (feeInSmallestUnit < tokenSupport.minPromptPrice) {
        newErrors.feePerMessage = `Fee must be at least ${
          Number(tokenSupport.minPromptPrice) / Math.pow(10, selectedToken.decimals)
        } ${selectedToken.symbol}`
      }
    }

    // Validate initial balance
    const balanceNumber = parseFloat(formData.initialBalance)
    if (isNaN(balanceNumber) || balanceNumber < 0) {
      newErrors.initialBalance = 'Initial balance must be a positive number'
    } else if (tokenSupport?.minInitialBalance) {
      const balanceInSmallestUnit = BigInt(balanceNumber * Math.pow(10, selectedToken.decimals))
      if (balanceInSmallestUnit < tokenSupport.minInitialBalance) {
        newErrors.initialBalance = `Initial balance must be at least ${
          Number(tokenSupport.minInitialBalance) / Math.pow(10, selectedToken.decimals)
        } ${selectedToken.symbol}`
      }
    }
    
    if (tokenBalance?.balance) {
      const balanceInSmallestUnit = BigInt(balanceNumber * Math.pow(10, selectedToken.decimals))
      if (balanceInSmallestUnit > tokenBalance.balance) {
        newErrors.initialBalance = `Insufficient balance. You have ${tokenBalance.formatted} ${selectedToken.symbol}`
      }
    }

    // Validate system prompt
    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required'
    }

    // Validate end time
    const endDate = new Date(formData.endTime)
    const now = new Date()
    if (endDate <= now) {
      newErrors.endTime = 'End time must be in the future'
    }
    // Add validation for maximum timestamp (max u64)
    const endTimeSeconds = Math.floor(endDate.getTime() / 1000)
    if (endTimeSeconds > Number.MAX_SAFE_INTEGER) {
      newErrors.endTime = 'End time is too far in the future'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for the field being edited
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const { sendAsync } = useSendTransaction({
    calls: useMemo(() => {
      if (!account || !registryAddress || !registry || !tokenContract) return undefined
      
      // Check if we have valid numbers before creating the calls
      const feeNumber = parseFloat(formData.feePerMessage)
      const balanceNumber = parseFloat(formData.initialBalance)
      if (isNaN(feeNumber) || isNaN(balanceNumber) || !formData.endTime) return undefined

      try {
        const selectedToken = ACTIVE_NETWORK.tokens[formData.selectedToken]
        const promptPrice = uint256.bnToUint256(
          BigInt(Math.floor(feeNumber * Math.pow(10, selectedToken.decimals)))
        )
        const initialBalance = uint256.bnToUint256(
          BigInt(Math.floor(balanceNumber * Math.pow(10, selectedToken.decimals)))
        )
        const endTimeSeconds = Math.floor(new Date(formData.endTime).getTime() / 1000)

        return [
          tokenContract.populate("approve", [
            registryAddress,
            initialBalance,
          ]),
          registry.populate("register_agent", [
            formData.agentName,
            formData.systemPrompt,
            selectedToken.address,
            promptPrice,
            initialBalance,
            endTimeSeconds
          ])
        ]
      } catch (error) {
        debug.error('LaunchAgent', 'Error preparing transaction calls:', error)
        return undefined
      }
    }, [formData, account, registryAddress, selectedToken, registry, tokenContract])
  })

  const handleLaunchAgent = async () => {
    if (!validateForm() || !account || !registry || !tokenContract) return

    try {
      setTransactionStep(TransactionStep.SUBMITTING)
      const response = await sendAsync()
      if (response?.transaction_hash) {
        setTransactionHash(response.transaction_hash)
        await account.waitForTransaction(response.transaction_hash)
        setTransactionStep(TransactionStep.COMPLETED)
        setTimeout(() => setCurrentView(AGENT_VIEWS.ACTIVE_AGENTS), 2000)
      }
    } catch (error) {
      debug.error('LaunchAgent', 'Error registering agent:', error)
      setTransactionStep(TransactionStep.FAILED)
      setErrors(prev => ({ ...prev, submit: 'Failed to register agent. Please try again.' }))
    }
  }

  const getButtonText = () => {
    switch (transactionStep) {
      case TransactionStep.SUBMITTING:
        return 'Submitting transaction...'
      case TransactionStep.COMPLETED:
        return 'Success! Redirecting...'
      case TransactionStep.FAILED:
        return 'Failed. Try again'
      default:
        return 'Launch Agent'
    }
  }

  const isTransacting = [
    TransactionStep.SUBMITTING,
    TransactionStep.COMPLETED
  ].includes(transactionStep)

  const selectedTokenSupport = supportedTokens[formData.selectedToken]
  const isFormValid = Object.values(formData).every((value) => value.trim() !== '')

  // Base container styles that will be shared across all states
  const containerStyles = "min-h-[600px] transition-all duration-200 ease-in-out"

  if (isLoadingSupport) {
    return (
      <section className={`${containerStyles} flex items-center justify-center`}>
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-white">Loading supported tokens...</span>
        </div>
      </section>
    )
  }

  if (supportedTokenList.length === 0) {
    return (
      <section className={`${containerStyles} flex items-center justify-center text-white`}>
        No supported tokens available
      </section>
    )
  }

  const minPromptPriceDisplay = selectedTokenSupport?.minPromptPrice 
    ? (Number(selectedTokenSupport.minPromptPrice) / Math.pow(10, selectedToken.decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 18,
        useGrouping: false
      })
    : null;

  const minInitialBalanceDisplay = selectedTokenSupport?.minInitialBalance 
    ? (Number(selectedTokenSupport.minInitialBalance) / Math.pow(10, selectedToken.decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 18,
        useGrouping: false
      })
    : null;

  return (
    <section className={containerStyles}>
      <div className="text-[#A4A4A4] text-sm grid grid-cols-2 py-4 border-b border-b-[#2F3336]">
        <p className="">Launching agent</p>
      </div>

      <div className="py-6 text-[#A4A4A4] text-xs flex flex-col gap-4">
        {/* Agent Name Field */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>Agent name</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Name of your agent (max 31 characters)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <input
              type="text"
              name="agentName"
              value={formData.agentName}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-transparent outline-none min-h-[34px] p-2 focus:border-white text-white"
              placeholder="Agent name..."
              maxLength={31}
              disabled={isTransacting}
            />
            {errors.agentName && <p className="text-red-500 mt-1">{errors.agentName}</p>}
          </div>
        </div>

        {/* Token Selection */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>Token</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select token for fees</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <select
              name="selectedToken"
              value={formData.selectedToken}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-black/80 outline-none min-h-[34px] p-2 focus:border-white text-white"
              disabled={isTransacting}
            >
              {supportedTokenList.map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
            {errors.selectedToken && <p className="text-red-500 mt-1">{errors.selectedToken}</p>}
            {!isLoadingBalance && tokenBalance?.formatted && (
              <p className="text-gray-400 mt-1">
                Your balance: {tokenBalance.formatted} {selectedToken.symbol}
              </p>
            )}
          </div>
        </div>

        {/* Fee Per Message */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>Fee per message</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fee per message in {selectedToken?.symbol}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <input
              type="text"
              name="feePerMessage"
              value={formData.feePerMessage}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-transparent outline-none min-h-[34px] p-2 focus:border-white text-white"
              placeholder={`0.00 ${selectedToken?.symbol}`}
              disabled={isTransacting}
            />
            {errors.feePerMessage && <p className="text-red-500 mt-1">{errors.feePerMessage}</p>}
            {minPromptPriceDisplay && (
              <p className="text-gray-400 mt-1">
                Minimum fee: {minPromptPriceDisplay} {selectedToken.symbol}
              </p>
            )}
          </div>
        </div>

        {/* Initial Balance */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>Initial balance</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Initial balance in {selectedToken?.symbol}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <input
              type="text"
              name="initialBalance"
              value={formData.initialBalance}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-transparent outline-none min-h-[34px] p-2 focus:border-white text-white"
              placeholder={`0.00 ${selectedToken?.symbol}`}
              disabled={isTransacting}
            />
            {errors.initialBalance && (
              <div className="flex items-center gap-1 text-red-500 mt-1">
                <AlertCircle width={12} height={12} />
                <p>{errors.initialBalance}</p>
              </div>
            )}
            {minInitialBalanceDisplay && (
              <p className="text-gray-400 mt-1">
                Minimum initial balance: {minInitialBalanceDisplay} {selectedToken.symbol}
              </p>
            )}
            {!isLoadingBalance && tokenBalance?.formatted && (
              <p className="text-gray-400 mt-1">
                Your balance: {tokenBalance.formatted} {selectedToken.symbol}
              </p>
            )}
          </div>
        </div>

        {/* End Time */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>End time</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>When the agent will stop accepting new prompts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <input
              type="date"
              name="endTime"
              value={formData.endTime}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-transparent outline-none min-h-[34px] p-2 focus:border-white text-white"
              min={new Date().toISOString().split('T')[0]}
              disabled={isTransacting}
            />
            {errors.endTime && <p className="text-red-500 mt-1">{errors.endTime}</p>}
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[#E1CC6E]">System prompt</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The System Prompt is your agent&apos;s foundation. Make it &apos;strong&apos; to
                    defend against attacks and ensure it stays on purpose.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleInputChange}
              className="w-full border border-[#818181] rounded-sm bg-transparent outline-none min-h-[34px] p-2 focus:border-white text-white"
              placeholder="Enter system prompt..."
              rows={5}
              disabled={isTransacting}
            />
            {errors.systemPrompt && <p className="text-red-500 mt-1">{errors.systemPrompt}</p>}
          </div>
        </div>

        <p className="text-xs text-white mt-4">
          Users will receive 15% of fee generated by messages, 5% goes to Nethermind team
        </p>

        {/* Transaction Status */}
        {transactionHash && (
          <div className="flex items-center gap-2 text-white">
            <Loader2 size={16} className="animate-spin" />
            <a
              href={`${ACTIVE_NETWORK.explorer}/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              View transaction
            </a>
          </div>
        )}

        {errors.submit && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle width={16} height={16} />
            <p>{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <button
          className="bg-white disabled:text-[#6F6F6F] disabled:border-[#6F6F6F] rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent disabled:bg-transparent"
          disabled={!isFormValid || isTransacting}
          onClick={handleLaunchAgent}
        >
          {isTransacting && <Loader2 size={16} className="animate-spin mr-2" />}
          {getButtonText()}
        </button>

        <button
          className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black disabled:opacity-50"
          onClick={() => setCurrentView(AGENT_VIEWS.ACTIVE_AGENTS)}
          disabled={isTransacting}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
