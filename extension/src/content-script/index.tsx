if (import.meta.hot) {
  import.meta.hot.accept()
}

// Your content script code here
import React from 'react'
import ReactDOM from 'react-dom'
import ContentApp from './ContentApp'
import { StarknetProvider } from './components/starknet-provider'
import '../index.css'

const init = () => {
  const root = document.createElement('div')
  root.id = 'jack-the-ether-root'
  document.body.appendChild(root)

  ReactDOM.render(
    <React.StrictMode>
      <StarknetProvider>
        <ContentApp />
      </StarknetProvider>
    </React.StrictMode>,
    root
  )
}

// Add a small delay to ensure DOM is ready
setTimeout(() => {
  init()
}, 100)
