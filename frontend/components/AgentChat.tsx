import { AGENT_CHAT_DATA } from '@/mock-data'
import Image from 'next/image'

export const AgentChat = () => {
  return (
    <div>
      <div className="flex flex-col max-w-[480px] mx-auto">
        {AGENT_CHAT_DATA.map((chat) => {
          return (
            <div
              className={`flex items-start gap-3 w-fit mb-4 py-2 md:py-4 px-2 rounded-lg max-w-[360px] md:max-w-[409px] ${
                chat.isBot ? 'mr-auto' : 'ml-auto flex-row-reverse'
              }
              ${chat.isUpgrated ? 'bg-[#625C4566]' : 'bg-[#27313666]'}
              `}
              key={chat.id}
            >
              <div className="w-7 h-7 rounded-full shrink-0">
                <Image
                  src={chat.profileUrl}
                  width="28"
                  height="28"
                  alt="profile"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              <div className="text-xs">
                <p className="font-medium mb-1">{chat.username}</p>
                <p className="mb-1 text-[#D3E7F0]">{chat.description}</p>
                <div className="flex justify-between">
                  {chat.isUpgrated && (
                    <div>
                      <Image src={'/icons/crown.png'} width={16} height={16} alt="crown" />
                    </div>
                  )}

                  <p className="text-[10px] font-light text-right ms-auto">1 week ago</p>
                </div>
              </div>
            </div>
          )
        })}
        <button className="text-[#0088FF] text-sm font-light w-fit ms-auto">Show all</button>
      </div>
    </div>
  )
}
