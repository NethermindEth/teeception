import React from 'react'
import ReactDOM from 'react-dom/client'
import ContentApp from './ContentApp'
console.log('Content script loaded')

const root = document.createElement('div')
root.id = 'crx-root'
document.body.appendChild(root)

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ContentApp />
  </React.StrictMode>
)