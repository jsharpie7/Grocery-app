import { useState, useEffect } from 'react'

interface Props {
  startTime: Date | null
  running: boolean
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Stopwatch({ startTime, running }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running || !startTime) return

    const update = () => {
      setElapsed(Date.now() - startTime.getTime())
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [running, startTime])

  return (
    <div className="bg-gray-100 px-3 py-1.5 rounded-full">
      <span className="font-mono text-sm font-semibold text-gray-700 tabular-nums">
        {formatTime(elapsed)}
      </span>
    </div>
  )
}
