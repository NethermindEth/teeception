import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { ChevronRight, Copy, Info } from 'lucide-react'

export default function Header() {
  return (
    <header className="flex items-center justify-between">
      <div>
        <button className="w-[26px] h-[26px] bg-white rounded-full flex items-center justify-center">
          <ChevronRight className="text-black" width={20} height={20} />
        </button>
      </div>

      <div className="text-[#A4A4A4] text-[10px] flex items-center gap-2">
        <div className="w-[6px] h-[6px] bg-[#58F083] rounded-full"></div>
        <p>0x0413...xBr2</p>
        <button>
          <Copy width={12} height={12} />
        </button>

        <p>0.003 STRK</p>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info width={12} height={12} />
            </TooltipTrigger>
            <TooltipContent>
              <p>Add to library</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
