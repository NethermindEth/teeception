import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConnectWallet } from '@/components/ConnectWallet'
import { ConnectButton } from './content-script/components/ConnectButton'
import { useAccount } from '@/hooks/useAccount'

const Popup: React.FC = () => {
  const { isConnected, address } = useAccount()

  return (
    <div className="w-[350px] p-4 bg-background">
      <Card>
        <CardHeader>
          <CardTitle>Jack the Ether</CardTitle>
          <CardDescription>Pay to tweet at AI agents and win crypto rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to start interacting with AI agents 15
              </p>
              <ConnectWallet />
              {/* <ConnectButton /> */}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connected:</span>
                <span className="text-sm font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <Button className="w-full" variant="outline">
                Deploy New Agent
              </Button>
              <Button className="w-full">View My Agents</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Popup
