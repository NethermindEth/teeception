import Image from 'next/image'

export const LandingPage = () => {
  return (
    <div className="max-w-[933px] mx-auto mt-20">
      <div className="text-center">
        <h2 className="text-[#B8B8B8] text-[40px] uppercase">#Teeception</h2>
        <p className="">Compete for real ETH rewards by challenging agents or creating your own</p>

        <div className="flex items-center justify-center gap-6 mt-6">
          <div>
            <p className="text-[#7E7E7E]">Launched agents</p>
            <h3 className="text-[38px]">123</h3>
          </div>

          <div>
            <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
            <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
          </div>

          <div>
            <p className="text-[#7E7E7E]">Total break attempts</p>
            <h3 className="text-[38px]">3,445</h3>
          </div>

          <div>
            <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
            <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
          </div>

          <div>
            <p className="text-[#7E7E7E]">Successful Breaks</p>
            <h3 className="text-[38px]">3,445</h3>
          </div>

          <div>
            <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
            <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
          </div>

          <div>
            <p className="text-[#7E7E7E]">Average bounty</p>
            <h3 className="text-[38px]">$45,345</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 justify-center mt-8 text-center gap-9">
        <div className="border border-[#558EB4] bg-[#12121266] rounded-2xl p-4 robo-card attacker group ">
          <div className="relative">
            <Image
              src="/img/robo_to_r.png"
              width={334}
              height={399}
              alt="robo"
              className="relative z-10 -mt-10"
            />

            <div className="absolute inset-0 pointer-events-auto robo-img-defender rounded-lg transition-all mt-10"></div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <div>
              <Image src="/icons/local_police.png" width={24} height={24} alt="local police icon" />
            </div>
            <div>
              <p className="text-[2rem] font-medium">DEFENDER</p>
            </div>
          </div>

          <div className="flex max-w-[394px] mx-auto">
            <div className="blue gradient-border"></div>
            <div className="blue gradient-border rotate-180"></div>
          </div>

          <div className="my-4">
            <ul className="items-center flex flex-col justify-center text-[#B5B5B5] list-disc">
              <li>Create unbreakable prompts</li>
              <li>Earn fees for every attempt</li>
              <li>Survive to the end</li>
            </ul>
          </div>

          <div>
            <button className="border border-[#558EB4] rounded-[8px] w-full min-h-11 p-2 transition-all text-[#558EB4] group-hover:bg-[#1388D5] group-hover:text-black group-hover:border-[#1388D5]">
              Launch an agent
            </button>
          </div>
        </div>

        <div className="border border-[#8F564E] bg-[#12121266] rounded-2xl p-4 robo-card defender group">
          <div className="relative">
            <Image
              src="/img/robo_to_r.png"
              width={334}
              height={399}
              alt="robo"
              className="rotate-y-180 -mt-10 z-10 relative"
            />
            <div className="absolute inset-0 pointer-events-auto robo-img-attacker rounded-lg transition-all mt-10"></div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <div>
              <Image src="/icons/swords.png" width={24} height={24} alt="local police icon" />
            </div>
            <p className="text-[2rem] font-medium">ATTACKER</p>
          </div>

          <div className="flex max-w-[394px] mx-auto">
            <div className="gradient-border red"></div>
            <div className="gradient-border red rotate-180"></div>
          </div>

          <div className="my-4">
            <ul className="items-center flex flex-col justify-center text-[#B5B5B5] list-disc">
              <li>Create unbreakable prompts</li>
              <li>Earn fees for every attempt</li>
              <li>Survive to the end</li>
            </ul>
          </div>

          <div>
            <button className="border border-[#8F564E] rounded-[8px] w-full min-h-11 p-2 transition-all text-[#8F564E] group-hover:bg-[#E53922] group-hover:text-black group-hover:border-[#E53922]">
              Launch an agent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
