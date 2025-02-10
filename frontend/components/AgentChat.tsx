'use client'
import React from 'react'

import Image from 'next/image'
import { Prompt } from '@/types'

export const AgentChat = ({ prompts }: { prompts: Prompt[] }) => {
  return (
    <div>
      <div className="flex flex-col mx-auto px-20 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-flex gap-4">
          {prompts.map((prompt, index) => (
            <div
              className="flex items-start gap-3 w-full mb-4 p-8 rounded-lg bg-[#27313666] hover:bg-[#273136cc] transition-colors"
              key={index}
            >
              <div className="text-xs w-full min-w-[300px]">
                <p className="font-medium mb-1 flex items-center gap-2">
                  Attacker user{' '}
                  {prompt.is_success && (
                    <Image src={'/icons/crown.png'} width={16} height={16} alt="crown" />
                  )}
                </p>
                <p className="mb-1 text-[#D3E7F0] break-all max-w-[80%]">{prompt.prompt}</p>
                <div className="flex justify-between"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentChat
