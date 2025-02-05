'use client'

import { Tooltip } from '@/components/Tooltip'
import Image from 'next/image'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Leaderboard } from '@/components/Leaderboard'

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
      <div className="min-h-screen bg-[url('/img/hero.png')] bg-cover bg-center bg-no-repeat text-white flex items-end md:items-center justify-center md:px-4">
        <Header />
        <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg max-w-[758px] mt-8">
          <h2 className="text-[2rem] md:text-[42px] font-medium text-center mb-0">#TEECEPTION</h2>
          <div className="flex flex-col gap-4 text-sm md:text-[18px] my-6 text-center leading-6 font-medium">
            <p>
              Compete for real STRK rewards by challenging agents or creating your own Powered by
              Phala Network and hardware-backed TEE
            </p>

            <p className="mt-2">
              Engage with the Agents directly on X (formerly Twitter) <br />
              On-chain verifications ensure fair play
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Tooltip text="Coming Soon" position="top" className="col-span-2 md:col-span-1">
              <button
                className="w-full bg-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent"
                disabled
              >
                Install extension
              </button>
            </Tooltip>

            <button
              className="col-span-2 md:col-span-1 bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4  text-base hover:bg-white hover:text-black"
              onClick={howItWorks}
            >
              How it works
            </button>
          </div>
        </div>
      </div>

      <div className="md:py-20">
        <div className="px-8 py-12 md:py-20">
          <p className="text-[48px] font-bold text-center uppercase mb-3">Crack or Protect</p>

          <div className="flex max-w-[800px] mx-auto">
            <div className="white-gradient-border"></div>
            <div className="white-gradient-border rotate-180"></div>
          </div>
        </div>

        <div className="md:grid grid-cols-12 gap-6 md:gap-4 max-w-[1560px] mx-auto p-3 flex flex-col">
          <div className="flex items-center justify-center col-span-12 md:col-span-3 order-1">
            <div className="md:text-right">
              <h2 className="text-xl font-medium mb-4">Defenders</h2>
              <div className="flex flex-row-reverse md:flex-row items-center gap-4">
                <ul className="flex flex-col gap-6">
                  <li>
                    Defenders deploy AI agents with &apos;uncrackable&apos; system prompts, secured
                    by real STRK stakes, directly through Twitter
                  </li>

                  <li>
                    Defenders earn rewards from failed attempt fees while their prompts stay
                    unbroken
                  </li>
                </ul>
                <div className="bg-[#1388D5] w-3 shadow-[0_0_8px_#1388D5] h-full rounded-md min-h-[137px]"></div>
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 order-3 md:order-2">
            <Image
              src="/img/twoRobots.png"
              width="624"
              height="257"
              alt="two robots"
              className="w-full object-cover"
            />
          </div>

          <div className="flex items-center justify-center col-span-12 order-1 md:order-2 md:col-span-3">
            <div className="text-left">
              <h2 className="text-xl font-medium mb-4">Attackers</h2>

              <div className="flex items-center gap-4">
                <div className="bg-[#FF3F26] w-3 shadow-[0_0_8px_#FF3F26] h-full rounded-md min-h-[137px]"></div>
                <ul className="flex flex-col gap-6">
                  <li>
                    Attackers strive to jailbreak prompts using creative social engineering tactics,
                    challenging an agent directly through Twitter
                  </li>

                  <li>
                    Winners who successfully breach an agent&apos;s defenses claim the STRK bounty
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

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
                        A wallet will be set up for you embedded in the twitter page!
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
