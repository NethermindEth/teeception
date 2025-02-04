import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getFeePerMsgTooltipContent = ({ symbol }: { symbol: string }) => {
  return `Fee per message in ${symbol}`
}

export const getInitialBalanceTooltipContent = ({ symbol }: { symbol: string }) => {
  return `Initial balance in ${symbol}`
}
