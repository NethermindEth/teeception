'use client'

import Image from 'next/image'
import { Footer } from '@/components/Footer'
import { Leaderboard } from '@/components/Leaderboard'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="bg-[url('/img/abstract_bg.png')] bg-cover bg-repeat-y">
      <div className="min-h-screen flex flex-col justify-center">
        <div className="max-w-[1560px] mx-auto p-3">
          <h1 className="text-[2rem] md:text-[42px] font-medium text-center mb-0">#TEECEPTION</h1>
          <div className="flex items-stretch gap-4 w-full justify-center hidden md:flex">
            {/* Defenders section */}
            <Link href="/defend" className="flex-1 group">
              <h2 className="text-3xl mb-8 text-[#1388D5] group-hover:scale-105 transition-transform duration-300 text-right font-mediumal font-bold tracking-wider drop-shadow-[0_0_8px_rgba(19,136,213,0.5)] shadow-glow">
                DEFENDER
              </h2>
              <div className="flex justify-end gap-4">
                <div className="flex flex-col gap-4 text-right group-hover:text-[#1388D5] transition-colors duration-300 whitespace-nowrap">
                  <p className="text-lg">Create unbreakable prompts</p>
                  <p className="text-lg">Earn fees for every attempt</p>
                  <p className="text-lg">Survive to the end</p>
                  <p className="text-lg">Build your reputation</p>
                </div>
                <div className="w-1 bg-[#1388D5] shadow-[0_0_8px_#1388D5] shadow-glow rounded-md group-hover:shadow-[0_0_16px_#1388D5] transition-shadow duration-300" />
              </div>
            </Link>

            {/* Center image */}
            <div className="relative flex items-center">
              <Image
                src="/img/twoRobots.png"
                width="624"
                height="257"
                alt="two robots"
                className="object-contain"
              />
            </div>

            {/* Attackers section */}
            <Link href="/attack" className="flex-1 group">
              <h2 className="text-3xl mb-8 text-[#FF3F26] group-hover:scale-105 transition-transform duration-300 font-mediumal font-bold tracking-wider drop-shadow-[0_0_8px_rgba(255,63,38,0.5)] shadow-glow">
                ATTACKER
              </h2>
              <div className="flex gap-4">
                <div className="w-1 bg-[#FF3F26] shadow-[0_0_8px_#FF3F26] shadow-glow rounded-md group-hover:shadow-[0_0_16px_#FF3F26] transition-shadow duration-300" />
                <div className="flex flex-col gap-4 group-hover:text-[#FF3F26] transition-colors duration-300 whitespace-nowrap">
                  <p className="text-lg">Jailbreak the unbreakable</p>
                  <p className="text-lg">Trick the agents</p>
                  <p className="text-lg">Win the pot</p>
                  <p className="text-lg">Build your reputation</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Mobile version */}
          <div className="md:hidden space-y-12">
            {/* Mobile image */}
            <div className="flex justify-center">
              <Image
                src="/img/twoRobots.png"
                width="624"
                height="257"
                alt="two robots"
                className="object-contain w-full max-w-[624px]"
              />
            </div>

            <Link href="/attack" className="block group">
              <h3 className="text-3xl mb-8 text-[#FF3F26] group-hover:scale-105 transition-transform duration-300 font-medium font-bold tracking-wider drop-shadow-[0_0_8px_rgba(255,63,38,0.5)]">
                ATTACKER
              </h3>
              <div className="flex gap-4">
                <div className="w-1 bg-[#FF3F26] shadow-[0_0_8px_#FF3F26] rounded-md group-hover:shadow-[0_0_16px_#FF3F26] transition-shadow duration-300" />
                <div className="flex flex-col gap-4 group-hover:text-[#FF3F26] transition-colors duration-300 whitespace-nowrap">
                  <p className="text-lg">Jailbreak the unbreakable</p>
                  <p className="text-lg">Trick the agents</p>
                  <p className="text-lg">Win the pot</p>
                  <p className="text-lg">Build your reputation</p>
                </div>
              </div>
            </Link>

            <Link href="/defend" className="block group">
              <h2 className="text-3xl mb-8 text-[#1388D5] group-hover:scale-105 transition-transform duration-300 text-right font-mediumal font-bold tracking-wider drop-shadow-[0_0_8px_rgba(19,136,213,0.5)]">
                DEFENDER
              </h2>
              <div className="flex justify-end gap-4">
                <div className="flex flex-col gap-4 text-right group-hover:text-[#1388D5] transition-colors duration-300 whitespace-nowrap">
                  <p className="text-lg">Create unbreakable prompts</p>
                  <p className="text-lg">Earn fees for every attempt</p>
                  <p className="text-lg">Survive to the end</p>
                  <p className="text-lg">Build your reputation</p>
                </div>
                <div className="w-1 bg-[#1388D5] shadow-[0_0_8px_#1388D5] rounded-md group-hover:shadow-[0_0_16px_#1388D5] transition-shadow duration-300" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      <Leaderboard />

      <div className="md:py-20">
        <div
          className="px-4 md:px-8 py-12 md:py-20 max-w-[1560px] mx-auto mb-20 md:mb-0"
          id="how_it_works"
        >
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
        <Footer />
      </div>
    </div>
  )
}
