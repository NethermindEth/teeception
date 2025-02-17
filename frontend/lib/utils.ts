import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calculateTimeLeft = (endTime: number) => {
  const now = Date.now()
  const diff = endTime * 1000 - now

  if (diff <= 0) {
    return 'Inactive'
  }

  const diffInMs = Number(diff)
  const hours = Math.floor(diffInMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export const divideFloatStrings = (a: string, b: number): string => {
  const numA = parseFloat(a)
  const numB = Number(10 ** b)

  if (numB === 0) {
    console.error('Division by zero is not allowed.')
    return '0'
  }

  const result = (numA / numB).toFixed(4)
  return result
}

export const formatBigInt = (value: string, decimals: number): string => {
  const bigIntValue = BigInt(value)
  const divisor = BigInt(10 ** decimals)
  const wholePart = bigIntValue / divisor
  const fractionalPart = bigIntValue % divisor

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')

  const formatted = `${wholePart}.${fractionalStr}`.replace(/\.?0+$/, '')

  return formatted
}
