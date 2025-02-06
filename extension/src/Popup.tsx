import React from 'react'

const Popup = () => {
  return (
    <div className="w-[350px] h-[400px] bg-black flex flex-col items-center p-6">
      <div className="flex-1 flex flex-col items-center gap-4">
        <img src="/icons/shield.svg" alt="teeception" className="w-[80px] h-auto" />
        <a 
          href="https://teeception.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white hover:text-gray-300 text-2xl font-medium transition-colors duration-200"
        >
          teeception.ai
        </a>
        <p className="text-gray-400 text-sm text-center">
          You will find a wallet on x.com, use it to challenge and create new agents.
        </p>
      </div>

      <div className="w-full flex flex-col gap-1">
        <p className="text-[#B8B8B8] text-[10.42px]">powered by</p>
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center justify-center">
            <a href="https://nethermind.io" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img 
                src="https://cdn.prod.website-files.com/63bcd69729ab7f3ec1ad210a/64bf04d14176fe2fb1aff258_Nethermind_Light_Horizontal%201.webp" 
                alt="nethermind" 
                className="h-[17px] w-auto"
              />
            </a>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <a href="https://starknet.io" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img src="/icons/starknet.svg" alt="starknet" className="w-[76px] h-[17px]" />
            </a>
            <span className="text-[#B8B8B8] text-lg">×</span>
            <a href="https://phala.network" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img src="/icons/phala.svg" alt="phala network" className="w-[28px] h-[28px] bg-black rounded-sm" />
            </a>
            <span className="text-[#B8B8B8] text-lg">×</span>
            <a href="https://cartridge.gg" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img src="/icons/cartridge.svg" alt="cartridge" className="h-[24px] w-auto" />
            </a>
          </div>
        </div>
        <p className="text-[#B8B8B8] text-xs">©2025 Nethermind. All Rights Reserved</p>
      </div>
    </div>
  )
}

export default Popup
