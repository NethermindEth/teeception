import React from 'react'
import ReactDOM from 'react-dom'
import { StarkwebProvider } from "starkweb/react"
import ContentApp from './ContentApp'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'starkwebkit'
import { starkwebConfig } from './config/starkweb'
import '../index.css'

console.log('🔵 Content script index.tsx loaded')

const init = () => {
  console.log('🟡 Init function called')
  
  const root = document.createElement('div')
  root.id = 'jack-the-ether-root'
  document.body.appendChild(root)
  
  console.log('🟢 Root element created and appended:', {
    rootId: root.id,
    rootInDOM: document.getElementById('jack-the-ether-root') !== null
  })

  const queryClient = new QueryClient()

  ReactDOM.render(
    <React.StrictMode>
      <StarkwebProvider config={starkwebConfig}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider debugMode={true}>
              <ContentApp />
          </ConnectKitProvider>
        </QueryClientProvider>
      </StarkwebProvider>
    </React.StrictMode>,
    root
  )
  
  console.log('🟣 ReactDOM.render called')
}

// Add a small delay to ensure DOM is ready
setTimeout(() => {
  console.log('⚪ Timeout started, calling init')
  init()
}, 100)

// Also try on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔴 DOMContentLoaded fired')
})

// And on load
window.addEventListener('load', () => {
  console.log('⚫ Window load fired')
})