'use client'

import clsx from 'clsx'
import { useState } from 'react'
import Image from 'next/image'
import { MenuItems } from './MenuItems'
import { Tooltip } from './Tooltip'
import { MenuIcon, Plus } from 'lucide-react'
import Link from 'next/link'

export const Header = ({}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const handleInstallExtension = () => {
    //TODO: add chrome line
    console.log('install extension handler called')
  }
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

        <div className="hidden md:flex">
          <Tooltip text="Coming Soon" position="bottom">
            <button
              onClick={handleInstallExtension}
              className="bg-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-sm md:text-base hover:bg-white/70"
              disabled
            >
              Install extension
            </button>
          </Tooltip>
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
