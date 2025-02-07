'use client'

import clsx from 'clsx'
import { useState } from 'react'
import Image from 'next/image'
import { MenuItems } from './MenuItems'
import { MenuIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      className={clsx(
        'fixed left-0 right-0 top-0 backdrop-blur-lg bg-[#12121266] min-h-[76px] z-10 transition-all',
        {
          'h-[119px]': menuOpen,
          'h-[67px]': !menuOpen,
        }
      )}
    >
      <div className="max-w-[1632px] mx-auto flex items-center p-[11px] md:p-4 justify-between">
        <div className="flex items-center justify-center">
          <Link className="block mr-1 md:mr-4" href="/">
            <Image src={'/icons/shield.svg'} width={40} height={44} alt="shield" />
          </Link>
          <div className="hidden md:block">
            <MenuItems />
          </div>
        </div>

        <div className="hidden md:flex gap-4">
          <ConnectButton />
        </div>
        <button className="ms-auto md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <Plus className="rotate-45" /> : <MenuIcon />}
        </button>
      </div>
      {menuOpen && (
        <div className="py-4 fadeIn">
          <MenuItems />
        </div>
      )}
    </header>
  )
}
