import React, { useEffect } from 'react'

export const ConnectButton = () => {
  console.log('🟨 ConnectButton rendering')
  
  useEffect(() => {
    console.log('🟧 ConnectButton mounted')
    return () => console.log('🟥 ConnectButton unmounted')
  }, [])

  return (
    <div 
      className="fixed top-4 right-4 z-[9999]"
      style={{
        width: '100px',
        height: '40px',
        backgroundColor: 'red',
        borderRadius: '8px'
      }}
      onClick={() => console.log('🟦 ConnectButton clicked')}
    >
      Test Button
    </div>
  )
} 