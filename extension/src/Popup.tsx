import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { connect, disconnect, StarknetWindowObject } from 'starknetkit'
import { WebWalletConnector } from 'starknetkit/webwallet'
import useStarknetStorage from './hooks/useStarknetStorage'
import { wallet, WalletAccount } from 'starknet'
const myFrontendProviderUrl = 'https://free-rpc.nethermind.io/sepolia-juno/v0_7'

const Popup = () => {
  const [connection, setConnection] = useState<StarknetWindowObject | null | undefined>(null)
  const [address, setAddress] = useState<string | undefined>(undefined)

  const { walletData, isLoading, error, saveWalletData } = useStarknetStorage()

  const handleConnect = async () => {
    // const { wallet, connectorData } = await connect({
    //   connectors: [new WebWalletConnector()],
    // })
    const wallet = await connect({
      connectors: [new WebWalletConnector()],
      resultType: 'wallet',
    })

    console.log('=== 240-0--', wallet)
    // if (wallet && connectorData) {
    //   console.log('Connected Account', connectorData.account)
    //   console.log('==== 19====', JSON.stringify(wallet))
    //   console.log('==== 20====', JSON.stringify(connectorData.account))
    //   setConnection(wallet)
    //   setAddress(connectorData.account)
    //   saveWalletData({ wallet, address: connectorData.account })
    // }
  }

  const handleDisconnect = async () => {
    await disconnect()
    setConnection(undefined)
    setAddress('')
  }

  useEffect(() => {
    if (walletData.wallet) {
      const walletSWO = walletData.wallet
      console.log('wallet swo', walletSWO)

      // const myWalletAccount = new WalletAccount({ nodeUrl: myFrontendProviderUrl }, walletSWO)
      // console.log('my wallet Account', myWalletAccount)
    }
  }, [walletData])

  console.log('wallet data', walletData)
  console.log('Connection', connection)
  console.log('Address', address)

  return (
    <div className="w-[350px] p-4 bg-background">
      <Card>
        <CardHeader>
          <CardTitle>Jack the Ether</CardTitle>
          <CardDescription>Pay to tweet at AI agents and win crypto rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {!walletData.address ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to start interacting with AI agents 15
              </p>
              <Button onClick={handleConnect} className="w-full">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connected:</span>
                <span className="text-sm font-mono">
                  {walletData.address?.slice(0, 6)}...{walletData.address?.slice(-4)}
                </span>
              </div>
            </div>
          )}
          {/* <Button onClick={handleConnect} className="w-full">
            Connect Wallet
          </Button> */}
        </CardContent>
      </Card>
    </div>
  )
}

export default Popup
