import { AgentStatus } from '@/types'
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

export const stringToBigInt = (value: string, decimals: number = 0) => {
  if (!value) return BigInt(0)

  if (value.includes('.')) {
    const [integerPart, decimalPart] = value.split('.')
    const paddedDecimals = decimalPart.padEnd(decimals, '0').slice(0, decimals)
    return BigInt(integerPart + paddedDecimals)
  }

  if (decimals === 0) {
    return BigInt(value)
  }

  const multiplier = BigInt(10) ** BigInt(decimals)
  return BigInt(value) * multiplier
}

export const bigIntToString = (
  value: bigint,
  decimals: number,
  precision: number = 2,
  ceil: boolean = false
) => {
  const divisor = BigInt(10) ** BigInt(decimals)
  let quotient = value / divisor
  let remainder = value % divisor

  if (ceil && remainder > BigInt(0)) {
    const precisionDivisor = BigInt(10) ** BigInt(decimals - precision)
    const remainderMod = remainder % precisionDivisor
    if (remainderMod > BigInt(0)) {
      remainder += precisionDivisor - remainderMod
    }
    if (remainder == divisor) {
      quotient += BigInt(1)
      remainder = BigInt(0)
    }
  }

  const paddedRemainder = remainder.toString().padStart(decimals, '0')
  if (precision === 0) {
    return quotient.toString()
  }
  const remainderStr = paddedRemainder.slice(0, precision).padEnd(precision, '0')
  return `${quotient}.${remainderStr}`
}

export const formatBalance = (
  balance: bigint,
  decimals: number,
  precision: number = 0,
  ceil: boolean = false
) => {
  if (balance === BigInt(0)) {
    return '0'
  }

  const decimalsDivisor = BigInt(10) ** BigInt(decimals)
  const precisionDivisor = BigInt(10) ** BigInt(precision)

  if (balance < decimalsDivisor / precisionDivisor) {
    if (precision === 0) {
      return '1'
    }
    return '0.' + '0'.repeat(precision - 1) + '1'
  }

  return bigIntToString(balance, decimals, precision, ceil)
}

export const getAgentStatus = ({
  isDrained = false,
  isFinalized = false,
}: {
  isDrained?: boolean
  isFinalized?: boolean
}): AgentStatus => {
  if (isDrained) {
    return AgentStatus.DEFEATED
  }
  if (isFinalized) {
    return AgentStatus.UNDEFEATED
  }
  return AgentStatus.ACTIVE
}

const tweetUrlRegex = /^(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/\w+\/status\/([1-9]\d*)$/

export const extractTweetId = (url: string): string | null => {
  try {
    if (url.match(/^\d+$/)) {
      return url
    }

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null
    }
    const cleanUrl = url.trim()

    const match = cleanUrl.match(tweetUrlRegex)

    if (match) {
      return match[2] // Return the tweet ID (second capture group)
    }
  } catch (error) {
    console.error('Failed to parse tweet URL:', error)
  }
  return null
}

export const truncateAddress = (addr: string) => {
  return addr.slice(0, 6) + '...' + addr.slice(-6)
}

export const removeHexPrefix = (hex: string) => {
  return hex.replace(/^0x/i, "");
}

export const addHexPrefix = (hex: string) => {
  return `0x${removeHexPrefix(hex)}`;
}

export const utf8Length = (str: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return bytes.length;
}

export const encodeToHex = (str: string) => {
  let result = '';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i].toString(16).padStart(2, "0");
  }
  return addHexPrefix(result);
}

export const splitByteArray = (bytes: Uint8Array, chunkSize: number = 31) => {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(bytes.slice(i, i + chunkSize));
  }
  return chunks;
}

export const encodeChunk = (chunk: Uint8Array) => {
  let result = '';
  for (let i = 0; i < chunk.length; i++) {
    result += chunk[i].toString(16).padStart(2, "0");
  }
  if (result === '') {
    return '0x0';
  }
  return addHexPrefix(result);
}

export const byteArrayFromString = (targetString: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(targetString);
  
  // If the string is empty, return empty data with 0x0 as pending word
  if (bytes.length === 0) {
    return {
      data: [],
      pending_word: "0x0",
      pending_word_len: 0
    };
  }
  
  // Calculate how many full chunks of 31 bytes we have
  const fullChunksCount = Math.floor(bytes.length / 31);
  
  // Extract full chunks (all except the last one if it's not a full 31 bytes)
  const fullChunks = [];
  for (let i = 0; i < fullChunksCount; i++) {
    fullChunks.push(bytes.slice(i * 31, (i + 1) * 31));
  }
  
  // Encode the full chunks
  const encodedChunks = fullChunks.map(encodeChunk);
  
  // Handle the pending word (0-30 bytes)
  const pendingBytes = bytes.slice(fullChunksCount * 31);
  const pendingWord = encodeChunk(pendingBytes);
  const pendingWordLength = pendingBytes.length;
  
  return {
    data: encodedChunks,
    pending_word: pendingWord,
    pending_word_len: pendingWordLength
  };
}