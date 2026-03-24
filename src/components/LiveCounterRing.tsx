import { useState, useEffect, useRef } from 'react'

const NAMES = [
  'Sarah Mitchell', 'James Okonkwo', 'Priya Sharma', 'Marcus Chen',
  'Amara Diallo', 'Liam Novak', 'Fatima Al-Rashid', 'Kenji Tanaka',
  'Elena Volkov', 'David Park', 'Aisha Bello', 'Thomas Wright',
]

const TOTAL = 24
const TICK_MS = 1600  // time between each check-in
const PAUSE_MS = 2800 // pause at completion before reset

interface FeedItem {
  id: number
  name: string
}

export default function LiveCounterRing() {
  const [count, setCount] = useState(0)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    if (count >= TOTAL) {
      const t = setTimeout(() => {
        setCount(0)
        setFeed([])
        idRef.current = 0
      }, PAUSE_MS)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      const name = NAMES[count % NAMES.length]
      const item: FeedItem = { id: idRef.current++, name }
      setFeed(prev => [item, ...prev].slice(0, 4))
      setCount(c => c + 1)
    }, TICK_MS)

    return () => clearTimeout(t)
  }, [count])

  const radius = 70
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - count / TOTAL)
  const isComplete = count === TOTAL

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '40px',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: '"DM Sans", sans-serif',
      color: '#FFFFFF',
      width: '100%',
      maxWidth: '700px',
      margin: '0 auto',
      padding: '20px 0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=DM+Sans:wght@400;500;700&display=swap');

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', width: '100%', maxWidth: '280px' }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#1B2D5B" strokeWidth={strokeWidth} />
            <circle
              cx="80" cy="80" r={radius}
              fill="transparent"
              stroke={isComplete ? '#34C759' : '#5B8CD4'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: `stroke-dashoffset ${TICK_MS * 0.6}ms cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease` }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '48px',
              fontWeight: 500,
              lineHeight: 1,
              color: isComplete ? '#34C759' : '#FFFFFF',
              transition: 'color 0.4s ease',
            }}>
              {count}
            </span>
            <span style={{ fontSize: '13px', color: '#7A8BA8', marginTop: '4px', fontWeight: 500 }}>of {TOTAL}</span>
          </div>
        </div>

        <div style={{
          marginTop: '24px',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: isComplete ? '#34C759' : '#5B8CD4',
          transition: 'color 0.4s ease',
        }}>
          {isComplete ? 'COMPLETE' : 'MARKING...'}
        </div>
      </div>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', width: '100%', maxWidth: '320px', minHeight: '280px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#7A8BA8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 20px 0' }}>
          Member Check-Ins
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {feed.length === 0 ? (
            <div style={{ color: '#7A8BA8', fontSize: '14px', fontStyle: 'italic', marginTop: '10px' }}>
              Waiting for check-ins...
            </div>
          ) : (
            feed.map((item, index) => {
              const isNewest = index === 0
              // Newest: green + slide-in animation. Older: tick + fade.
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: isNewest ? '#34C759' : 'transparent',
                    opacity: isNewest ? 1 : Math.max(0.25, 1 - index * 0.22),
                    // Only the newest row animates in; older rows hold their position
                    animation: isNewest ? `slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both` : 'none',
                    transition: 'background-color 0.4s ease, opacity 0.4s ease',
                  }}
                >
                  {/* Bullet / tick */}
                  {isNewest ? (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      marginRight: '12px',
                      boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                      flexShrink: 0,
                    }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" style={{ marginRight: '10px', flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" fill="none" stroke="#5B8CD4" strokeWidth="1.5" />
                      <polyline points="4.5,8 7,10.5 11.5,5.5" fill="none" stroke="#5B8CD4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span style={{
                    fontSize: '15px',
                    fontWeight: isNewest ? 700 : 500,
                    color: isNewest ? '#FFFFFF' : '#E2E8F0',
                  }}>
                    {item.name}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
