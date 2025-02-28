'use client'

import { useStarkProfile } from '@starknet-react/core'
import { BlockieAvatar } from './BlockieAvatar'

interface AttackerIdentifierProps {
  address: string
}

export const AttackerIdentifier = ({ address }: AttackerIdentifierProps) => {
  // Normalize the address for StarkNet: remove 0x prefix if present, pad to 64 characters, then add 0x prefix
  const normalizedAddress = address.startsWith('0x') 
    ? `0x${address.slice(2).padStart(64, '0')}` 
    : `0x${address.padStart(64, '0')}`
  
  // Cast to the required type for the hook
  const starknetAddress = normalizedAddress as `0x${string}`
  
  const { data: profile } = useStarkProfile({ address: starknetAddress })
  const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`
  
  // Only use StarkNet profile information if there's a name available
  const hasStarknetName = Boolean(profile?.name)
  
  return (
    <div className="flex items-center gap-2">
      {/* Show StarkNet profile picture or Blockie avatar */}
      {hasStarknetName && profile?.profilePicture ? (
        <img 
          src={profile.profilePicture} 
          alt={profile.name}
          className="h-5 w-5 rounded-full"
        />
      ) : (
        <BlockieAvatar address={address} size={20} />
      )}
      <span>
        {hasStarknetName ? (
          <span className="font-medium">{profile!.name}</span>
        ) : (
          formattedAddress
        )}
      </span>
    </div>
  )
} 