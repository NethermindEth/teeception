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

function injectScript(file_path, tag) {
  const node = document.getElementsByTagName(tag)[0]
  const script = document.createElement('script')
  script.setAttribute('type', 'text/javascript')
  script.setAttribute('src', file_path)
  node.appendChild(script)
}
injectScript(chrome.runtime.getURL('content.js'), 'body')

const port = chrome.runtime.connect()
let payload = { starknet_braavos: '', starknet_argentx: '' }

window.addEventListener(
  'message',
  (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) {
      return
    }

    if (event.data.type && event.data.type === 'FROM_PAGE') {
      console.log('Content script received: ' + event.data.payload)
      payload = event.data.payload
      port.postMessage(event.data.payload)
    }
  },
  false
)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log({ request, sender, sendResponse, starknet: window.starknet_braavos })
  if (request.type === 'GET_STARKNET_WALLETS') {
    sendResponse({
      success: true,
      payload: payload,
    })
  }
})
