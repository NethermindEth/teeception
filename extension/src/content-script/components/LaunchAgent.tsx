import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Info } from 'lucide-react'
import { AGENT_VIEWS } from './AgentView'
import { useState } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'
import { useAccount } from '@starknet-react/core'
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { Contract, RpcProvider, uint256 } from 'starknet'

interface FormData {
  agentName: string
  feePerMessage: string
  initialBalance: string
  systemPrompt: string
  selectedToken: string
}

interface FormErrors {
  agentName?: string
  feePerMessage?: string
  initialBalance?: string
  systemPrompt?: string
  selectedToken?: string
}

export default function LaunchAgent({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) {
  const { account } = useAccount()
  const { address: registryAddress } = useAgentRegistry()
  const [formData, setFormData] = useState<FormData>({
    agentName: '',
    feePerMessage: '',
    initialBalance: '',
    systemPrompt: '',
    selectedToken: Object.keys(ACTIVE_NETWORK.tokens)[0],
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required'
    }

    const feeNumber = parseFloat(formData.feePerMessage)
    if (isNaN(feeNumber) || feeNumber < 0) {
      newErrors.feePerMessage = 'Fee must be a positive number'
    }

    const balanceNumber = parseFloat(formData.initialBalance)
    if (isNaN(balanceNumber) || balanceNumber < 0) {
      newErrors.initialBalance = 'Initial balance must be a positive number'
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required'
    }

    if (!formData.selectedToken) {
      newErrors.selectedToken = 'Token selection is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLaunchAgent = async () => {
    if (!validateForm() || !account || !registryAddress) return

    setIsLoading(true)
    try {
      const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
      const registry = new Contract(AGENT_REGISTRY_COPY_ABI, registryAddress, provider)
      
      // Connect the contract to the user's account
      registry.connect(account)

      const selectedToken = ACTIVE_NETWORK.tokens[formData.selectedToken]
      const promptPrice = uint256.bnToUint256(
        BigInt(parseFloat(formData.feePerMessage) * Math.pow(10, selectedToken.decimals))
      )
      
      // Current timestamp + 1 year in seconds
      const endTime = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60)

      const response = await registry.register_agent(
        formData.agentName,
        formData.systemPrompt,
        promptPrice,
        endTime
      )

      console.log('Agent registered:', response)
      setCurrentView(AGENT_VIEWS.ACTIVE_AGENTS)
    } catch (error) {
      console.error('Error registering agent:', error)
      setErrors(prev => ({ ...prev, submit: 'Failed to register agent' }))
    } finally {
      setIsLoading(false)
    }
  }

  const selectedToken = ACTIVE_NETWORK.tokens[formData.selectedToken]
  const isFormValid = Object.values(formData).every((value) => value.trim() !== '')

  return (
    <section className="pt-5">
      <div className="text-[#A4A4A4] text-sm grid grid-cols-2 py-4 border-b border-b-[#2F3336]">
        <p className="">Launching agent</p>
      </div>
      <div className="py-6 text-[#A4A4A4] text-xs flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <p>Agent name</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Name of your agent</p>
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
            />
            {errors.agentName && <p className="text-red-500 mt-1">{errors.agentName}</p>}
          </div>
        </div>

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
            >
              {Object.entries(ACTIVE_NETWORK.tokens).map(([symbol, token]) => (
                <option key={symbol} value={symbol}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
            {errors.selectedToken && <p className="text-red-500 mt-1">{errors.selectedToken}</p>}
          </div>
        </div>

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
            />
            {errors.feePerMessage && <p className="text-red-500 mt-1">{errors.feePerMessage}</p>}
          </div>
        </div>

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
            />
            {errors.initialBalance && <p className="text-red-500 mt-1">{errors.initialBalance}</p>}
          </div>
        </div>

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
            />
            {errors.systemPrompt && <p className="text-red-500 mt-1">{errors.systemPrompt}</p>}
          </div>
        </div>

        <p className="text-xs text-white my-4">
          Users will receive 15% of fee generated by messages, 5% goes to Nethermind team
        </p>

        <button
          className="bg-white disabled:text-[#6F6F6F] disabled:border-[#6F6F6F] rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent disabled:bg-transparent"
          disabled={!isFormValid || isLoading}
          onClick={handleLaunchAgent}
        >
          {isLoading ? 'Launching...' : 'Launch Agent'}
        </button>

        <button
          className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black"
          onClick={() => setCurrentView(AGENT_VIEWS.ACTIVE_AGENTS)}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
