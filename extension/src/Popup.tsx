import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const Popup = () => {
  const [address] = useState<string | undefined>(undefined)

  return (
    <div className="w-[350px] p-4 bg-background">
      <Card>
        <CardHeader>
          <CardTitle>Jack the Ether</CardTitle>
          <CardDescription>Pay to tweet at AI agents and win crypto rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {!address ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your wallet by heading to x.com and you will see connet wallet button at the
                top
              </p>
              <Button onClick={() => {}} className="w-full">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connected:</span>
                <span className="text-sm font-mono">
                  {/* {walletData.address?.slice(0, 6)}...{walletData.address?.slice(-4)} */}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Popup
