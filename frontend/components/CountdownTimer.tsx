import React, { useState, useEffect } from 'react'

interface CountdownTimerProps {
  endTime: number
  size?: 'sm' | 'md' | 'lg'
  isFinalized: boolean
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  endTime,
  size = 'md',
  isFinalized = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [isActive, setIsActive] = useState<boolean>(true)

  // Size configurations
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      dot: 'w-1 h-1',
      numberWidth: 'min-w-[14px]',
      gap: 'space-x-1.5',
      dotSpacing: 'ml-1.5',
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      dot: 'w-1.5 h-1.5',
      numberWidth: 'min-w-[18px]',
      gap: 'space-x-2',
      dotSpacing: 'ml-2',
    },
    lg: {
      container: 'px-4 py-2 text-base',
      dot: 'w-2 h-2',
      numberWidth: 'min-w-[22px]',
      gap: 'space-x-2.5',
      dotSpacing: 'ml-2.5',
    },
  }

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now()
      const diff = endTime * 1000 - now

      if (diff <= 0) {
        setIsActive(false)
        return null
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      return { days, hours, minutes, seconds }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)

      if (!newTimeLeft) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime])

  if (!isActive || isFinalized) {
    return (
      <div
        className={`inline-flex items-center bg-black rounded-full ${sizeClasses[size].container}`}
      >
        <div className={`${sizeClasses[size].dot} bg-[#FF4444] rounded-full`} />
        <span className={`${sizeClasses[size].dotSpacing} text-[#FF4444]`}>
          {!isActive ? 'Inactive' : 'Finalized'}
        </span>
      </div>
    )
  }

  if (!timeLeft) {
    return null
  }

  const TimeUnit = ({ value, unit }: { value: number; unit: string }) => (
    <div className="flex items-center">
      <span className={`text-white ${sizeClasses[size].numberWidth} text-right tabular-nums`}>
        {value}
      </span>
      <span className="text-gray-400 ml-0.5">{unit}</span>
    </div>
  )

  return (
    <div
      className={`inline-flex items-center bg-black rounded-full ${sizeClasses[size].container}`}
    >
      <div className={`${sizeClasses[size].dot} bg-[#00D369] rounded-full`} />
      <div className={`${sizeClasses[size].dotSpacing} flex ${sizeClasses[size].gap}`}>
        {timeLeft.days > 0 && <TimeUnit value={timeLeft.days} unit="d" />}
        {(timeLeft.days > 0 || timeLeft.hours > 0) && <TimeUnit value={timeLeft.hours} unit="h" />}
        <TimeUnit value={timeLeft.minutes} unit="m" />
        <TimeUnit value={timeLeft.seconds} unit="s" />
      </div>
    </div>
  )
}

export default CountdownTimer
