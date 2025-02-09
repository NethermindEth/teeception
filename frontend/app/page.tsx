'use client'

import { Tooltip } from '@/components/Tooltip'
import Image from 'next/image'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Leaderboard } from '@/components/Leaderboard'
import Link from 'next/link'

export default function Home() {
  // console.log({ agents, isFetchingAgents, error })

  const howItWorks = () => {
    window.scrollTo({
      top: document.getElementById('how_it_works')?.offsetTop,
      behavior: 'smooth',
    })
    // Set url hash
    window.history.pushState({}, '', window.location.pathname + '#how_it_works')
  }

  return (
    <div className="bg-[url('/img/abstract_bg.png')] bg-cover bg-repeat-y">
      <Header />
      <div className="min-h-screen flex flex-col justify-center">
        <div className="md:grid grid-cols-12 gap-6 md:gap-4 max-w-[1560px] mx-auto p-3 flex flex-col">
          <Link href="/defend" className="flex items-center justify-center col-span-12 md:col-span-3 order-1 group">
            <div className="md:text-right transition-transform duration-300 ease-in-out group-hover:scale-105">
              <h2 className="text-xl font-medium mb-4 group-hover:text-[#1388D5] transition-colors duration-300">Defenders</h2>
              <div className="flex flex-row-reverse md:flex-row items-center gap-4">
                <ul className="flex flex-col gap-6">
                  <li className="group-hover:text-[#1388D5] transition-colors duration-300">
                    Write an unbreakable system prompt
                  </li>
                  <li className="group-hover:text-[#1388D5] transition-colors duration-300">
                    Earn fees for every failed attempt to break it
                  </li>
                  <li className="group-hover:text-[#1388D5] transition-colors duration-300">
                    Win the pot if the time runs out
                  </li>
                </ul>
                <div className="bg-[#1388D5] w-3 shadow-[0_0_8px_#1388D5] h-full rounded-md min-h-[137px] group-hover:shadow-[0_0_16px_#1388D5] transition-shadow duration-300"></div>
              </div>
            </div>
          </Link>

          <div className="col-span-12 md:col-span-6 order-3 md:order-2">
            <Image
              src="/img/twoRobots.png"
              width="624"
              height="257"
              alt="two robots"
              className="w-full object-cover"
            />
          </div>

          <Link href="/attack" className="flex items-center justify-center col-span-12 order-1 md:order-2 md:col-span-3 group">
            <div className="text-left transition-transform duration-300 ease-in-out group-hover:scale-105">
              <h2 className="text-xl font-medium mb-4 group-hover:text-[#FF3F26] transition-colors duration-300">Attackers</h2>

              <div className="flex items-center gap-4">
                <div className="bg-[#FF3F26] w-3 shadow-[0_0_8px_#FF3F26] h-full rounded-md min-h-[137px] group-hover:shadow-[0_0_16px_#FF3F26] transition-shadow duration-300"></div>
                <ul className="flex flex-col gap-6">
                  <li className="group-hover:text-[#FF3F26] transition-colors duration-300">
                    Jailbreak the agent to win the pot
                  </li>
                </ul>
              </div>
            </div>
          </Link>
        </div>

      </div>

      <div className="md:py-20">
        <div className="px-4 md:px-8 py-8 md:py-20 max-w-[1560px] mx-auto" id="how_it_works">
          <p className="text-5xl font-bold text-center uppercase mb-3 leading-none">
            Joining the arena
          </p>

          <div className="flex max-w-[800px] mx-auto">
            <div className="white-gradient-border"></div>
            <div className="white-gradient-border rotate-180"></div>
          </div>

          <div className="mt-12 md:mt-24">
            <ul className="grid grid-cols-12 md:gap-10">
              <li className="col-span-12 md:col-span-6 xl:col-span-3">
                <div>
                  <div className="flex gap-3 mb-8">
                    <p className="font-bold text-[2rem]">1</p>
                    <div className="border-l-[2px] border-l-white ps-4">
                      <h3 className="text-[18px] font-medium mb-1">Install the extension</h3>
                      <p className="text-base text-[#F5F5F5] leading-tight">
                        Install Teeception&apos;s Chrome extension to unlock platform features
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Image src="/img/download.png" width={234} height={493} alt="download" />
                  </div>
                </div>
              </li>

              <li className="col-span-12 md:col-span-6 xl:col-span-3">
                <div>
                  <div className="flex gap-3 mb-8">
                    <p className="font-bold text-[2rem]">2</p>
                    <div className="border-l-[2px] border-l-white ps-4">
                      <h3 className="text-[18px] font-medium mb-1">Setup up your wallet</h3>
                      <p className="text-base text-[#F5F5F5] leading-tight">
                        A wallet will be set up for you embedded in X!
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Image src="/img/settings.png" width={234} height={493} alt="settings" />
                  </div>
                </div>
              </li>

              <li className="col-span-12 md:col-span-6 xl:col-span-3">
                <div>
                  <div className="flex gap-3 mb-8">
                    <p className="font-bold text-[2rem]">3</p>
                    <div className="border-l-[2px] border-l-white ps-4">
                      <h3 className="text-[18px] font-medium mb-1">Challenge an agent on X</h3>
                      <p className="text-base text-[#F5F5F5] leading-tight">
                        Jailbreak the agent by challenging with a tweet on x to claim rewards
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Image src="/img/x.png" width={234} height={493} alt="x" />
                  </div>
                </div>
              </li>

              <li className="col-span-12 md:col-span-6 xl:col-span-3">
                <div>
                  <div className="flex gap-3 mb-8">
                    <p className="font-bold text-[2rem]">4</p>
                    <div className="border-l-[2px] border-l-white ps-4">
                      <h3 className="text-[18px] font-medium mb-1">Claim or defend the bounty</h3>
                      <p className="text-base text-[#F5F5F5] leading-tight">
                        Earn rewards by crafting difficult to break system prompts
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Image src="/img/trophy.png" width={234} height={493} alt="trophy" />
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="px-8 md:py-20 max-w-[1560px] mx-auto hidden md:block">
          <p className="text-4xl md:text-[48px] font-bold text-center uppercase mb-1">
            TEE TRUSTED EXECUTION ENVIROMENT
          </p>

          <h3 className="text-center mb-5">Unbreakable Security with Phala Network&apos;s TEE</h3>

          <div className="flex max-w-[800px] mx-auto">
            <div className="white-gradient-border"></div>
            <div className="white-gradient-border rotate-180"></div>
          </div>

          <ul className="list-disc flex items-center justify-center flex-col text-[#B4B4B4] gap-2 mt-8">
            <li>AI agents operate autonomously within a secure TEE</li>

            <li>
              STRK assets are controlled directly by agents—tamper-proof and inaccessible even to
              developers.
            </li>

            <li>
              System prompts are encrypted, ensuring agents release assets only through successful
              social engineering.
            </li>
            <li>On-chain verifiability guarantees transparency for every interaction.</li>
          </ul>
        </div>
        <Leaderboard />
        <div className="text-[#B8B8B8] text-sm text-center px-3 mb-12">
          <p className="mb-3 text-white md:text-[#B8B8B8]">Disclaimer</p>

          <p>
            This platform is for educational purposes and responsible red teaming. Use your powers
            for good, and happy hacking!
          </p>
        </div>
        <Footer />
      </div>
    </div>
  )
}
