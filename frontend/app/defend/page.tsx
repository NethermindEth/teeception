'use client'

import { useState } from 'react'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { ConnectPrompt } from '@/components/ConnectPrompt'

export default function DefendPage() {
  const { address } = useAccount()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    agentName: '',
    systemPrompt: '',
    feePerMessage: '',
    initialBalance: '',
    duration: '30' // 30 days default
  })

  if (!address) {
    return (
      <>
        <Header />
        <ConnectPrompt
          title="Welcome Defender"
          subtitle="One step away from showing your skills"
          theme="defender"
        />
      </>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // TODO: Implement agent deployment logic
      console.log('Deploying agent:', formData)
    } catch (error) {
      console.error('Failed to deploy agent:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <h1 className="text-4xl font-bold mb-8">Deploy Agent</h1>
        
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Agent Name</label>
            <input
              type="text"
              name="agentName"
              value={formData.agentName}
              onChange={handleInputChange}
              className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
              placeholder="Enter agent name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">System Prompt</label>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleInputChange}
              className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3 min-h-[200px]"
              placeholder="Enter system prompt..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fee per Message (STRK)</label>
            <input
              type="number"
              name="feePerMessage"
              value={formData.feePerMessage}
              onChange={handleInputChange}
              className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Initial Balance (STRK)</label>
            <input
              type="number"
              name="initialBalance"
              value={formData.initialBalance}
              onChange={handleInputChange}
              className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Duration (days)</label>
            <select
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
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
            disabled={isSubmitting}
            className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deploying...
              </div>
            ) : (
              'Deploy Agent'
            )}
          </button>
        </form>
      </div>
    </>
  )
} 