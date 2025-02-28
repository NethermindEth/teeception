'use client'

import Blockies from 'react-blockies'

interface BlockieAvatarProps {
  address: string
  size?: number
}

export const BlockieAvatar = ({ address, size = 24 }: BlockieAvatarProps) => {
  // Normalize the address: remove 0x prefix if present, then pad to 64 characters
  const normalizedAddress = address.startsWith('0x') 
    ? address.slice(2).padStart(64, '0') 
    : address.padStart(64, '0')
  
  // Add 0x prefix back for the seed
  const seed = `0x${normalizedAddress}`.toLowerCase()
  
  return (
    <div 
      className="overflow-hidden rounded-full" 
      style={{ 
        height: `${size}px`, 
        width: `${size}px`, 
        minWidth: `${size}px` 
      }}
    >
      <Blockies
        seed={seed}
        size={8} // Number of blocks
        scale={size / 8} // Size of each block
      />
    </div>
  )
} 