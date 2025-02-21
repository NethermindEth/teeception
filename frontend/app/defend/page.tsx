'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  StarknetTypedContract,
  useAccount,
  useContract,
  useSendTransaction,
} from '@starknet-react/core'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { ACTIVE_NETWORK, AGENT_REGISTRY_ADDRESS, SYSTEM_PROMPT_MAX_TOKENS } from '@/constants'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { addAddressPadding, InvokeTransactionReceiptResponse, TransactionExecutionStatus, uint256 } from 'starknet'
import { AgentLaunchSuccessModal } from '@/components/AgentLaunchSuccessModal'
import Link from 'next/link'
import { useRouter } from 'nextjs-toploader/app'
import { useTokenCount } from '@/hooks/useTokenCount'
import { useTokenParams } from '@/hooks/useTokenParams'

const useAgentForm = (tokenBalance: { balance?: bigint; formatted?: string } | undefined, tokenParams: { params: { minPromptPrice?: bigint; minInitialBalance?: bigint } }) => {
  const [formState, setFormState] = useState({
    values: {
      agentName: '',
      systemPrompt: '',
      feePerMessage: '',
      initialBalance: '',
      duration: '30',
    },
    errors: {} as Record<string, string>,
    isSubmitting: false,
    transactionStatus: 'idle' as 'idle' | 'submitting' | 'completed' | 'failed',
    transactionHash: null as string | null,
    agentAddress: null as string | null,
  })

  const validateField = useCallback(
    (name: string, value: string) => {
      switch (name) {
        case 'agentName':
          if (!value.trim()) return 'Agent name is required'
          if (value.length > 31) return 'Agent name must be 31 characters or less'
          break
        case 'feePerMessage':
          const fee = parseFloat(value)
          if (isNaN(fee) || fee < 0) return 'Fee must be a positive number'
          const feeInSmallestUnit = BigInt(Math.floor(fee * Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals)))
          if (tokenParams.params.minPromptPrice && feeInSmallestUnit < tokenParams.params.minPromptPrice) {
            return `Fee must be at least ${Number(tokenParams.params.minPromptPrice) / Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals)} ${ACTIVE_NETWORK.tokens[0].symbol}`
          }
          break
        case 'initialBalance':
          const balance = parseFloat(value)
          if (isNaN(balance) || balance < 0) return 'Initial balance must be a positive number'
          const balanceInSmallestUnit = BigInt(Math.floor(balance * Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals)))
          if (tokenParams.params.minInitialBalance && balanceInSmallestUnit < tokenParams.params.minInitialBalance) {
            return `Initial balance must be at least ${Number(tokenParams.params.minInitialBalance) / Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals)} ${ACTIVE_NETWORK.tokens[0].symbol}`
          }
          if (tokenBalance?.balance && balanceInSmallestUnit > tokenBalance.balance) {
            return `Insufficient balance. You have ${tokenBalance.formatted} ${ACTIVE_NETWORK.tokens[0].symbol}`
          }
          break
        case 'systemPrompt':
          if (!value.trim()) return 'System prompt is required'
          break
      }
      return ''
    },
    [tokenBalance, tokenParams]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target
      setFormState((prev) => ({
        ...prev,
        values: { ...prev.values, [name]: value },
        errors: {
          ...prev.errors,
          [name]: validateField(name, value),
        },
      }))
    },
    [validateField]
  )

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    Object.entries(formState.values).forEach(([key, value]) => {
      const error = validateField(key, value)
      if (error) newErrors[key] = error
    })
    setFormState((prev) => ({ ...prev, errors: newErrors }))
    return Object.keys(newErrors).length === 0
  }, [formState.values, validateField])

  return {
    formState,
    setFormState,
    handleChange,
    validateForm,
  }
}

const useTransactionManager = (
  registry: StarknetTypedContract<typeof TEECEPTION_AGENTREGISTRY_ABI>,
  tokenContract: StarknetTypedContract<typeof TEECEPTION_ERC20_ABI>,
  formData: {
    agentName: string
    systemPrompt: string
    feePerMessage: string
    initialBalance: string
    duration: string
  }
) => {
  const { sendAsync } = useSendTransaction({
    calls: useMemo(() => {
      if (!registry || !tokenContract) return undefined

      const feeNumber = parseFloat(formData.feePerMessage)
      const balanceNumber = parseFloat(formData.initialBalance)
      if (isNaN(feeNumber) || isNaN(balanceNumber)) return undefined

      try {
        const selectedToken = ACTIVE_NETWORK.tokens[0]
        const promptPrice = uint256.bnToUint256(
          BigInt(Math.floor(feeNumber * Math.pow(10, selectedToken.decimals)))
        )
        const initialBalance = uint256.bnToUint256(
          BigInt(Math.floor(balanceNumber * Math.pow(10, selectedToken.decimals)))
        )
        const endTimeSeconds = Math.floor(
          new Date().getTime() / 1000 + parseInt(formData.duration) * 86400
        )

        const calldata = [
          tokenContract.populate('approve', [AGENT_REGISTRY_ADDRESS, initialBalance]),
          registry.populate('register_agent', [
            formData.agentName,
            formData.systemPrompt,
            'gpt-4',
            selectedToken.originalAddress,
            promptPrice,
            initialBalance,
            endTimeSeconds,
          ]),
        ]

        // console.log('Calldata', calldata[1])
        return calldata
      } catch (error) {
        console.error('Error preparing transaction calls:', error)
        return undefined
      }
    }, [registry, tokenContract, formData]),
  })

  return sendAsync
}

const FormInput = ({
  label,
  name,
  error,
  ...props
}: {
  label: string
  name: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (
  <div>
    <label className="block text-sm font-medium mb-2">{label}</label>
    <input
      name={name}
      className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
      {...props}
    />
    {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
  </div>
)

export default function DefendPage() {
  const router = useRouter()
  const { address, account } = useAccount()
  const { balance: tokenBalance } = useTokenBalance('STRK')
  const { params: tokenParams } = useTokenParams(ACTIVE_NETWORK.tokens.find(token => token.symbol === 'STRK')?.address || '')
  const { contract: registry } = useContract({
    address: AGENT_REGISTRY_ADDRESS as `0x${string}`,
    abi: TEECEPTION_AGENTREGISTRY_ABI,
  })
  const { contract: tokenContract } = useContract({
    address: ACTIVE_NETWORK.tokens[0].address as `0x${string}`,
    abi: TEECEPTION_ERC20_ABI,
  })
  const { formState, setFormState, handleChange, validateForm } = useAgentForm(tokenBalance!, { params: tokenParams })
  const [showSuccess, setShowSuccess] = useState(false)
  const { tokenCount, countTokens, isDebouncing: isTokenCountDebouncing } = useTokenCount()

  const sendAsync = useTransactionManager(registry!, tokenContract!, formState.values)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm() || !address || !account || !registry || !tokenContract) return
    setFormState((prev) => ({
      ...prev,
      isSubmitting: true,
      transactionStatus: 'submitting',
    }))

    try {
      const response = await sendAsync()
      if (response?.transaction_hash) {
        const receipt = await account.waitForTransaction(response.transaction_hash, {
          successStates: [TransactionExecutionStatus.SUCCEEDED],
        })
        const invokeReceipt = receipt as InvokeTransactionReceiptResponse;
        const agentAddress = invokeReceipt.events[1].keys[1];
        const paddedAgentAddress = addAddressPadding(agentAddress);
        
        setFormState((prev) => ({ 
          ...prev, 
          transactionHash: response.transaction_hash,
          agentAddress: paddedAgentAddress,
          transactionStatus: 'completed' 
        }))
        setShowSuccess(true)
      }
    } catch (error) {
      console.error('Error registering agent:', error)
      setFormState((prev) => ({
        ...prev,
        transactionStatus: 'failed',
        errors: { ...prev.errors, submit: 'Failed to register agent. Please try again.' },
      }))
    } finally {
      setFormState((prev) => ({ ...prev, isSubmitting: false }))
    }
  }

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    countTokens(value) // Update token count
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, systemPrompt: value },
    }))
  }

  const handleLaunchSuccessModalClose = () => {
    setShowSuccess(false)
    router.push(`/attack/${formState.agentAddress}`)
  }

  if (!address) {
    return (
      <ConnectPrompt
        title="Welcome Defender"
        subtitle="One step away from showing your skills"
        theme="defender"
      />
    )
  }

  const minPromptPrice = tokenParams?.minPromptPrice ? 
    Number(tokenParams.minPromptPrice) / Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals) : 
    0

  const minInitialBalance = tokenParams?.minInitialBalance ?
    Number(tokenParams.minInitialBalance) / Math.pow(10, ACTIVE_NETWORK.tokens[0].decimals) :
    0

  return (
    <div className="container mx-auto px-4 py-4 pt-24 relative">
      <Link
        href="/"
        className="hidden md:flex items-center gap-1 text-gray-400 hover:text-white transition-colors absolute z-20"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Home</span>
      </Link>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Deploy Agent</h1>
        <FormInput
          label="Agent Name"
          name="agentName"
          value={formState.values.agentName}
          onChange={handleChange}
          error={formState.errors.agentName}
          placeholder="Enter agent name"
          required
        />

        <div>
          <label className="block text-sm font-medium mb-2">System Prompt</label>
          <textarea
            name="systemPrompt"
            value={formState.values.systemPrompt}
            onChange={handleSystemPromptChange}
            className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3 min-h-[200px]"
            placeholder="Enter system prompt..."
            required
          />
          <p className={`mt-1 text-sm text-gray-400 ${isTokenCountDebouncing ? 'animate-pulse' : ''}`}>
            Tokens: {tokenCount} / {SYSTEM_PROMPT_MAX_TOKENS}
          </p>
          {tokenCount > SYSTEM_PROMPT_MAX_TOKENS && (
            <p className="mt-1 text-sm text-red-500">
              System prompt exceeds token limit
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Fee per Message (STRK)</label>
            <span className="block text-sm text-white/40">
              (Minimum: {minPromptPrice} STRK)
            </span>
          </div>
          <input
            type="number"
            name="feePerMessage"
            value={formState.values.feePerMessage}
            onChange={handleChange}
            className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
            placeholder="0.00"
            step="0.01"
            min={minPromptPrice}
            required
          />
          {formState.errors.feePerMessage && (
            <p className="mt-1 text-sm text-red-500">{formState.errors.feePerMessage}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Initial Balance (STRK)</label>
            <div className="text-right">
              <span className="block text-sm text-white/40">
                (Minimum: {minInitialBalance} STRK)
              </span>
              {tokenBalance && (
                <span className="block text-sm text-white/40">
                  (Available Balance: {Number(tokenBalance?.formatted || 0).toFixed(2)} STRK)
                </span>
              )}
            </div>
          </div>
          <input
            type="number"
            name="initialBalance"
            value={formState.values.initialBalance}
            onChange={handleChange}
            className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
            placeholder="0.00"
            step="0.01"
            min={minInitialBalance}
            required
          />
          {formState.errors.initialBalance && (
            <p className="mt-1 text-sm text-red-500">{formState.errors.initialBalance}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Duration (days)</label>
          <select
            name="duration"
            value={formState.values.duration}
            onChange={handleChange}
            className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
            required
          >
            <option value="1">1 Day</option>
            <option value="7">1 Week</option>
            <option value="14">2 Weeks</option>
            <option value="30">1 Month</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
        >
          {formState.isSubmitting ? (
            <>
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deploying...
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#383838]">
                <div className="h-full w-full bg-[#558EB4] animate-loading-progress" />
              </div>
            </>
          ) : (
            'Deploy Agent'
          )}
        </button>

        {formState.errors.submit && (
          <p className="mt-2 text-sm text-red-500 text-center">{formState.errors.submit}</p>
        )}
      </form>
      <AgentLaunchSuccessModal
        open={showSuccess}
        transactionHash={formState.transactionHash!}
        agentName={formState.values.agentName}
        onClose={handleLaunchSuccessModalClose}
      />
    </div>
  )
}
