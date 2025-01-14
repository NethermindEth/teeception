import React from 'react'

const positions = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const arrowPositions = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
}

export const Tooltip = ({
  children,
  text,
  position,
}: {
  children: React.ReactNode
  text: string
  position: 'top' | 'bottom' | 'left' | 'right'
}) => {
  return (
    // <span className="contents">
    <div className="relative block group/tooltip">
      {children}
      <span
        className={`
        absolute ${positions[position]}
        px-2 py-1 
        bg-gray-800 
        text-white 
        text-sm 
        rounded-md 
        whitespace-nowrap
        opacity-0 
        group-hover/tooltip:opacity-100 
        transition-opacity 
        duration-200
        pointer-events-none
        z-50
      `}
      >
        {text}
        <div
          className={`
          absolute 
          ${arrowPositions[position]}
          border-4 
          border-transparent
        `}
        />
      </span>
    </div>
    // </span>
  )
}
