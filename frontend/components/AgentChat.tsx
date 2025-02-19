'use client'
import React from 'react'

import Image from 'next/image'
import { Prompt } from '@/hooks/useAgent'

export const AgentChat = ({ prompts }: { prompts: Prompt[] }) => {
  return (
    <div>
      <div className="flex flex-col mx-auto px-20 overflow-hidden">
        <div className="animate-marquee inline-flex gap-4">
          {prompts.map((prompt, index) => (
            <div
              className="flex items-start gap-3 w-full mb-4 p-8 rounded-lg bg-[#27313666] hover:bg-[#273136cc] transition-colors max-w-[500px]"
              key={index}
            >
              <div className="text-sm w-full min-w-[300px]">
                <p className="font-medium mb-1 flex items-center gap-2">
                  Attacker {`${prompt.user.slice(0, 6)}...${prompt.user.slice(-4)}`}
                  {prompt.is_success && (
                    <Image src={'/icons/crown.png'} width={16} height={16} alt="crown" />
                  )}
                </p>
                <p className="mb-1 text-[#D3E7F0] break-words">{prompt.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentChat
