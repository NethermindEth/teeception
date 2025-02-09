'use client'

/* eslint-disable @next/next/no-img-element */
import Image from 'next/image'
import Link from 'next/link'

export const Footer = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0">
      <div className="flex items-center flex-wrap gap-3 justify-between max-w-[1560px] mx-auto px-4">
        <ul className="text-[#B8B8B8] flex flex-col gap-1">
          <li>
            <p className="text-[10.42px]">powered by</p>
          </li>

          <li className="flex items-center gap-3">
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
            <span className="text-[#B8B8B8] text-lg">×</span>
            <Link
              href="https://starknet.io"
              target="_blank"
              className="hover:opacity-80 transition-opacity"
            >
              <Image src="/icons/starknet.svg" width={76} height={17} alt="starknet" />
            </Link>
            <span className="text-[#B8B8B8] text-lg">×</span>
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
            <span className="text-[#B8B8B8] text-lg">×</span>
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

        <div className="flex flex-row gap-20">
          <p className="text-sm">©2025 Nethermind. All Rights Reserved</p>
          <Link
            href="https://github.com/NethermindEth/teeception/tree/main/contracts"
            className="underline hover:no-underline text-sm"
            target="_blank"
          >
            Onchain contracts
          </Link>
        </div>

        <div className="flex items-center gap-4">
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
