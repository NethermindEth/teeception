'use client'

import clsx from 'clsx'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { MenuItems } from './MenuItems'
import { MenuIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import { ConnectButton } from './ConnectButton'
import { BetaBanner } from './BetaBanner'

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll)
    const dismissed = localStorage.getItem('betaBannerDismissed')
    setBannerVisible(dismissed !== 'true')

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleBannerDismiss = () => {
    setBannerVisible(false)
  }

  return (
    <header
      className={clsx('fixed left-0 right-0 top-0 w-full z-50 transition-all duration-200', {
        'bg-[#12121266] backdrop-blur-xl': menuOpen || scrolled,
        'bg-transparent': !scrolled && !menuOpen,
      })}
    >
      <BetaBanner persistDismissal onDismiss={handleBannerDismiss} />
      <div
        className={clsx('max-w-full mx-auto flex items-center p-[11px] xl:p-4 justify-between', {
          'pt-[10px]': !bannerVisible,
        })}
      >
        <div className="flex items-center">
          <Link className="block mr-1 xl:mr-4 flex-shrink-0" href="/">
            <Image src={'/icons/shield.svg'} width={40} height={44} alt="shield" />
          </Link>
          <div className="hidden xl:block">
            <MenuItems menuOpen={menuOpen} />
          </div>
        </div>
        <div className="hidden xl:block">
          <ConnectButton
            showAddress
            className="bg-white text-black px-6 py-2 rounded-full hover:bg-white/90"
          />
        </div>
        <button
          className="xl:hidden flex-shrink-0 ml-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <Plus className="rotate-45 block" /> : <MenuIcon />}
        </button>
      </div>
      {menuOpen && (
        <div className="xl:hidden px-[11px] pb-4">
          <div className="py-4">
            <MenuItems menuOpen={menuOpen} />
          </div>
          <div className="mt-4">
            <ConnectButton
              showAddress
              className="bg-white text-black px-6 py-2 rounded-full hover:bg-white/90 w-full"
            />
          </div>
        </div>
      )}
    </header>
  )
}
