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
      modalContainer.style.position = 'fixed'
      modalContainer.style.top = '0'
      modalContainer.style.left = '0'
      modalContainer.style.right = '0'
      modalContainer.style.bottom = '0'
      modalContainer.style.zIndex = '9999'
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