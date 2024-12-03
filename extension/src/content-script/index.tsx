import React from 'react'
import ReactDOM from 'react-dom'
import ContentApp from './ContentApp'
import '../index.css'

const init = () => {
  const root = document.createElement('div')
  root.id = 'jack-the-ether-root'
  document.body.appendChild(root)

  ReactDOM.render(
    <React.StrictMode>
      <ContentApp />
    </React.StrictMode>,
    root
  )
}

init()