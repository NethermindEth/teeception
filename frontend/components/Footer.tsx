import Image from 'next/image'
import Link from 'next/link'

export const Footer = () => {
  return (
    <div className="flex items-center flex-wrap gap-3 justify-between max-w-[1560px] mx-auto px-4">
      <ul className="text-[#B8B8B8] flex flex-col gap-1">
        <li>
          <p className="text-[10.42px] ">powered by</p>
        </li>

        <li>
          <Image src="/icons/starknet-dark-theme.png" width={76} height={17} alt="starknet" />
        </li>

        <li className="text-xs">©2025 Nethermind. All Rights Reserved</li>
      </ul>

      <div>
        <Link
          href="https://github.com/NethermindEth/teeception/tree/main/contracts"
          className="underline hover:no-underline text-sm"
          target="_blank"
        >
          Smart contracts resource
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button>
          <Image src="/icons/x.png" width={20} height={20} alt="starknet" />
        </button>

        <button>
          <Image src="/icons/telegram.png" width={20} height={20} alt="starknet" />
        </button>
      </div>
    </div>
  )
}
