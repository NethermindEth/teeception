'use client'

/* eslint-disable @next/next/no-img-element */
import Image from 'next/image'
import Link from 'next/link'

export const Footer = () => {
  return (
    <div className="lg:fixed bottom-0 left-0 right-0 w-full backdrop-blur-md">
      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 justify-between max-w-[1560px] mx-auto px-4 py-2">
        {/* Powered by section */}
        <ul className="text-[#B8B8B8] flex flex-col gap-0 w-full md:w-auto">
          <li>
            <p className="text-[10.42px] text-center md:text-left">powered by</p>
          </li>

          <li className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <Link
              href="https://nethermind.io"
              target="_blank"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src="https://cdn.prod.website-files.com/63bcd69729ab7f3ec1ad210a/64bf04d14176fe2fb1aff258_Nethermind_Light_Horizontal%201.webp"
                alt="nethermind"
                className="h-[17px] w-auto"
              />
            </Link>
            <span className="text-[#B8B8B8] text-lg hidden md:inline">×</span>
            <Link
              href="https://starknet.io"
              target="_blank"
              className="hover:opacity-80 transition-opacity"
            >
              <Image src="/icons/starknet.svg" width={95} height={21} alt="starknet" />
            </Link>
            <span className="text-[#B8B8B8] text-lg hidden md:inline">×</span>
            <Link
              href="https://phala.network"
              target="_blank"
              className="hover:opacity-80 transition-opacity"
            >
              <Image
                src="/icons/phala.svg"
                width={28}
                height={28}
                alt="phala network"
                className="bg-black rounded-sm"
              />
            </Link>
            <span className="text-[#B8B8B8] text-lg hidden md:inline">×</span>
            <Link
              href="https://cartridge.gg"
              target="_blank"
              className="hover:opacity-80 transition-opacity"
            >
              <Image
                src="/icons/cartridge.svg"
                width={96}
                height={24}
                alt="cartridge"
                className="h-[24px] w-auto"
              />
            </Link>
          </li>
        </ul>

        {/* Copyright and contracts section */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-20 items-center">
          <p className="text-sm text-center">©2025 Nethermind. All Rights Reserved</p>
          <Link
            href="https://github.com/NethermindEth/teeception/tree/main/contracts"
            className="underline hover:no-underline text-sm"
            target="_blank"
          >
            Onchain contracts
          </Link>
        </div>

        {/* Social links section */}
        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <Link
            href="https://x.com/nethermindeth"
            target="_blank"
            className="hover:opacity-80 transition-opacity"
          >
            <Image src="/icons/x.svg" width={20} height={20} alt="X (Twitter)" />
          </Link>

          <Link
            href="https://t.me/nm_teeception"
            target="_blank"
            className="hover:opacity-80 transition-opacity"
          >
            <Image src="/icons/telegram.svg" width={20} height={20} alt="Telegram" />
          </Link>

          <Link
            href="https://github.com/NethermindEth/teeception"
            target="_blank"
            className="hover:opacity-80 transition-opacity"
          >
            <Image src="/icons/github.svg" width={20} height={20} alt="GitHub" />
          </Link>
        </div>
      </div>
    </div>
  )
}
