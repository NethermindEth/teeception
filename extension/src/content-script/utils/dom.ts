import { SELECTORS } from '../constants/selectors'
import { debug } from './debug'

/**
 * Creates or retrieves the modal container element
 * This container is used to render modals outside the normal DOM hierarchy
 * @returns The modal container element
 */
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

/**
 * Gets the current text content of the tweet textarea
 * @returns The tweet text content or an empty string if not found
 */
export const getTweetText = (): string => {
  try {
    const tweetBox = document.querySelector(SELECTORS.TWEET_TEXTAREA)
    const text = tweetBox?.textContent || ''
     
    return text
  } catch (error) {
    debug.error('DOM', 'Failed to get tweet text', error)
    return ''
  }
} 