import { useMemo } from 'react'

interface TallyCountProps {
  count: number
  className?: string
}

export function TallyCount({ count, className = '' }: TallyCountProps) {
  const tallyBlocks = useMemo(() => {
    const fullBlocks = Math.floor(count / 5)
    const remainder = count % 5
    return { fullBlocks, remainder }
  }, [count])

  return (
    <div className={`flex flex-wrap gap-4 items-center justify-center ${className}`}>
      {Array.from({ length: tallyBlocks.fullBlocks }).map((_, i) => (
        <div key={`full-${i}`} className="relative h-16 w-12 flex-shrink-0">
          {/* Vertical Bars */}
          <div className="absolute inset-0 flex justify-between px-1">
            <div className="h-full w-2 rounded-full bg-brand-slate/30" />
            <div className="h-full w-2 rounded-full bg-brand-slate/30" />
            <div className="h-full w-2 rounded-full bg-brand-slate/30" />
            <div className="h-full w-2 rounded-full bg-brand-slate/30" />
          </div>
          {/* Diagonal Slash */}
          <div className="absolute top-1/2 left-0 w-[110%] h-2 bg-brand-accent rounded-full -rotate-[22deg] -translate-y-1/2 -translate-x-1 shadow-sm shadow-brand-accent/40" />
        </div>
      ))}
      {tallyBlocks.remainder > 0 && (
        <div className="flex gap-2 h-16">
          {Array.from({ length: tallyBlocks.remainder }).map((_, i) => (
            <div key={`rem-${i}`} className="h-full w-2 rounded-full bg-brand-slate/30" />
          ))}
        </div>
      )}
    </div>
  )
}
