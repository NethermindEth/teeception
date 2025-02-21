import React from 'react'

const StatSkeleton = () => {
  const stats = ['Launched agents', 'Total break attempts', 'Successful breaks', 'Total bounty']

  return (
    <div className="flex items-center justify-center gap-2 lg:gap-6 mt-4 lg:mt-6">
      {stats.map((label, index) => (
        <React.Fragment key={label}>
          <div>
            <p className="text-[#7E7E7E] text-sm lg:text-base">{label}</p>
            <div className="animate-pulse">
              <div className="h-4 lg:h-12 w-32 bg-[#7E7E7E] rounded mt-1"></div>
            </div>
          </div>

          {index < stats.length - 1 && (
            <div>
              <div className="w-px h-full white-gradient-border-vertical-top min-h-10"></div>
              <div className="w-px h-full white-gradient-border-vertical-bottom min-h-10"></div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default StatSkeleton
