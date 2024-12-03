export const createModalContainer = () => {
  let container = document.getElementById('jack-the-ether-modal-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'jack-the-ether-modal-container'
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.right = '0'
    container.style.bottom = '0'
    container.style.zIndex = '9999'
    container.style.pointerEvents = 'none'
    document.body.appendChild(container)
  }
  return container
}

export const getTweetText = () => {
  const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]')
  return tweetBox?.textContent || ''
} 