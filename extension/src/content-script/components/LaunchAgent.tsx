import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Info } from 'lucide-react'
import { AGENT_VIEWS } from './AgentView'
import { useState } from 'react'

interface FormData {
  agentName: string
  feePerMessage: string
  initialBalance: string
  systemPrompt: string
}

interface FormErrors {
  agentName?: string
  feePerMessage?: string
  initialBalance?: string
  systemPrompt?: string
}

export default function LaunchAgent({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) {
  const [formData, setFormData] = useState<FormData>({
    agentName: '',
    feePerMessage: '',
    initialBalance: '',
    systemPrompt: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLaunchAgent = () => {
    if (validateForm()) {
      // Handle form submission
      console.log('Form submitted:', formData)
    }
  }

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
                  <p>Add to library</p>
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
            <p>Fee per message</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info width={12} height={12} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fee per message</p>
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
              placeholder="0.00"
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
                  <p>Initial balance</p>
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
              placeholder="0.00"
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
          disabled={!isFormValid}
          onClick={handleLaunchAgent}
        >
          Launch Agent
        </button>

        <button
          className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black"
          onClick={() => setCurrentView(AGENT_VIEWS.ACTIVE_AGENTS)}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
