import { useEffect, useState } from 'react'

/**
 * Creates and manages a modal container element in the DOM
 * @returns The modal container element if the modal is shown, null otherwise
 */
export const useModalContainer = (isVisible: boolean) => {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (isVisible) {
      const modalContainer = document.createElement('div')
      modalContainer.id = 'jack-the-ether-modal-container'
      modalContainer.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
      `
      document.body.appendChild(modalContainer)
      setContainer(modalContainer)

      return () => {
        modalContainer.remove()
        setContainer(null)
      }
    }
  }, [isVisible])

  return container
} 