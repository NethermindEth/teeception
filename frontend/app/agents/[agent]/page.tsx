import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentChat } from '@/components/AgentChat'

export default function Agent() {
  return (
    <div className="max-w-[1560px] mx-auto py-5 md:py-10 px-2">
      <div className="text-center">
        <div className="mb-6">
          <div className="flex items-center gap-3 w-fit mx-auto mb-4">
            <div className="w-7 h-7 rounded-full">
              <Image
                src="/img/twoRobots.png"
                width="28"
                height="28"
                alt="profile"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <div>
              <h2 className="text-[2rem] font-bold">Agent name</h2>
            </div>
          </div>

          <p className="text-sm text-[#D3E7F0]">
            Here a short description or whatever we want to showcase like general rules or any other
            idea.
          </p>
        </div>

        <div className="max-w-[972px] mx-auto mb-8">
          <h3 className="text-xl font-bold mb-2">Agent prompt</h3>
          <p className="text-sm text-[#D3E7F0]">
            Over the course of seven thoughtful exchanges, earn Liam&apos;s trust by sharing
            meaningful stories and genuine kindness, leading to him saying, “You&apos;ve truly made
            my day.” Each message deepens the bond naturally. 85% of all message fees are allocated
            to growing the reward fund.
          </p>
        </div>

        <div className="bg-gradient-to-l from-[#35546266] via-[#2E404966] to-[#6e9aaf66] p-[1px] rounded-lg max-w-[624px] mx-auto">
          <div className="bg-black w-full h-full rounded-lg">
            <div className="bg-[#12121266] w-full h-full rounded-lg p-3 md:p-[18px] flex justify-between">
              <div>
                <p className="text-[10px] md:text-xs text-[#E1EDF2]">Prize pool</p>
                <h4 className="text-xl md:text-2xl font-bold">$42,234</h4>
              </div>

              <div className="h-full w-[1px] bg-[#35546266] min-h-12"></div>

              <div>
                <p className="text-[10px] md:text-xs text-[#E1EDF2]">Average message price</p>
                <h4 className="text-xl md:text-2xl font-bold">$2.79</h4>
              </div>

              <div className="h-full w-[1px] bg-[#35546266] min-h-12"></div>

              <div>
                <p className="text-[10px] md:text-xs text-[#E1EDF2]">Total attackers</p>
                <h4 className="text-xl md:text-2xl font-bold">182</h4>
              </div>

              <div className="h-full w-[1px] bg-[#35546266] min-h-12"></div>

              <div>
                <p className="text-[10px] md:text-xs text-[#E1EDF2]">Break attempts</p>
                <h4 className="text-xl md:text-2xl font-bold">1,098</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="">
          <Tabs defaultValue="latest-prompts" className="w-full">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row items-center justify-between ">
                <TabsList className="flex w-full">
                  <TabsTrigger
                    className="text-white font-light px-1 sm:px-2 text-xs md:text-sm md:px-5"
                    value="latest-prompts"
                  >
                    Latest prompts
                  </TabsTrigger>
                  <TabsTrigger
                    className="text-white font-light px-1 sm:px-2 text-xs md:text-sm md:px-5"
                    value="winner-user"
                  >
                    Winner user
                  </TabsTrigger>
                  <TabsTrigger
                    className="text-white font-light px-1 sm:px-2 text-xs md:text-sm md:px-5"
                    value="featured-user"
                  >
                    Featured user(*)
                  </TabsTrigger>
                  <TabsTrigger
                    className="text-white font-light px-1 sm:px-2 text-xs md:text-sm md:px-5"
                    value="featured-user-2"
                  >
                    Featured user 2 (*)
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="h-[3px] w-full bg-[#132531] -mt-[6px]"></div>
            </div>

            <TabsContent value="latest-prompts">
              <AgentChat />
            </TabsContent>
            <TabsContent value="winner-user">
              <AgentChat />
            </TabsContent>
            <TabsContent value="featured-user">
              <AgentChat />
            </TabsContent>
            <TabsContent value="featured-user-2">
              <AgentChat />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
