'use client'

import clsx from 'clsx'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { MenuItems } from './MenuItems'
import { MenuIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={clsx(
        'fixed left-0 right-0 top-0 w-full z-50 transition-all duration-200',
        {
          'h-[180px] bg-[#12121266] backdrop-blur-lg': menuOpen,
          'h-[67px]': !menuOpen,
          'bg-transparent': !scrolled && !menuOpen,
          'bg-[#12121266] backdrop-blur-lg': scrolled || menuOpen
        }
      )}
    >
      <div className="max-w-[1632px] mx-auto flex items-center p-[11px] md:p-4 justify-between">
        <div className="flex items-center justify-center">
          <Link className="block mr-1 md:mr-4" href="/">
            <Image src={'/icons/shield.svg'} width={40} height={44} alt="shield" />
          </Link>
          <div className="">
            <MenuItems />
          </div>
          <div
            className={clsx(
              'absolute right-6 top-16 flex items-center justify-end lg:top-auto lg:block left-0 lg:left-auto',
              {
                hidden: !menuOpen,
              }
            )}
          >
            <ConnectButton
              showAddress
              className={clsx(
                'bg-white text-black px-6 py-2 rounded-full hover:bg-white/90 lg:block col-span-11',
                {
                  block: menuOpen,
                  hidden: !menuOpen,
                }
              )}
            />
          </div>
        </div>

        <button className="ms-auto md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <Plus className="rotate-45" /> : <MenuIcon />}
        </button>
      </div>
    </header>
  )
}
