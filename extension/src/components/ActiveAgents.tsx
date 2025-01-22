import Header from './Header'

export default function ActiveAgents() {
  return (
    <div className="p-6">
      <Header />

      <section className="pt-5">
        <div className="text-[#A4A4A4] text-sm grid grid-cols-2 py-4 border-b border-b-[#2F3336]">
          <p className="">Active agents (14)</p>
          <p className="text-right">Pool size</p>
        </div>

        <div className="pt-3 max-h-[calc(100vh-240px)] overflow-auto pr-4 pb-12">
          {new Array(30).fill(0).map((_, index) => {
            return (
              <div className="text-base grid grid-cols-2 py-2" key={`item ${index}`}>
                <div>
                  <p>@Agent_1</p>
                </div>
                <div className="text-right">
                  <p>34,456,25 STRK</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 px-4 py-8 bg-[#12121266] backdrop-blur-sm absolute bottom-0 left-0 right-0">
          <a
            href="/launch-agent"
            className="bg-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent"
          >
            Launch Agent
          </a>
          <button className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black">
            Visit leaderboard
          </button>
        </div>
      </section>
    </div>
  )
}
