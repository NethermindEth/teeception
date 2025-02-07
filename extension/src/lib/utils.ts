import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getFeePerMsgTooltipContent = ({ symbol }: { symbol: string }) => {
  return `Fee per message in ${symbol}`
}

export const getInitialBalanceTooltipContent = ({ symbol }: { symbol: string }) => {
  return `Initial balance in ${symbol}`
}

export const deepMerge = <T extends object>(target: T, source: Partial<T>): T => {
  const output = { ...target }

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key as keyof T])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key as keyof T] })
        } else {
          output[key as keyof T] = deepMerge(
            target[key as keyof T] as object,
            source[key as keyof T] as object
          ) as T[keyof T]
        }
      } else if (source[key as keyof T] !== undefined) {
        Object.assign(output, { [key]: source[key as keyof T] })
      }
    })
  }
  return output
}

export const isObject = (item: unknown): item is object => {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item))
}
