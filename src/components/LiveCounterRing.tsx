import { useState, useEffect, useRef } from 'react'

const NAMES = [
  'Sarah Mitchell', 'James Okonkwo', 'Priya Sharma', 'Marcus Chen',
  'Amara Diallo', 'Liam Novak', 'Fatima Al-Rashid', 'Kenji Tanaka',
  'Elena Volkov', 'David Park', 'Aisha Bello', 'Thomas Wright',
  'Chloe Mensah', 'Rafael Santos', 'Yuki Nakamura', 'Blessing Eze',
  'Connor Walsh', 'Naledi Dlamini', 'Omar Khalil', 'Isabelle Dupont',
  'Tariq Osei', 'Nina Petrov', 'Kofi Asante', 'Hannah Johansson',
]

const TOTAL = 24
const TICK_MS = 1600
const PAUSE_MS = 2800

interface FeedItem {
  id: number
  name: string
}

const PRIMARY_LIGHT = '#c3c0ff'      // lavender
const PRIMARY_CONTAINER = '#5247e6' // indigo
const TRACK = '#151b2d'             // surface-low

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
      const name = NAMES[count]
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
      color: '#FFFFFF',
      width: '100%',
      maxWidth: '700px',
      margin: '0 auto',
      padding: '20px 0',
    }}>
      <style>{`
        @keyframes slideInFeed {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', width: '100%', maxWidth: '280px' }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>

          {/* Ambient glow behind ring */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: PRIMARY_CONTAINER,
            opacity: isComplete ? 0.22 : 0.1,
            filter: 'blur(20px)',
            transform: 'scale(0.72)',
            transition: 'opacity 0.6s ease',
          }} />

          <svg width="160" height="160" viewBox="0 0 160 160"
            style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
            <defs>
              <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track */}
            <circle cx="80" cy="80" r={radius}
              fill="transparent"
              stroke={TRACK}
              strokeWidth={strokeWidth}
            />

            {/* Progress arc */}
            <circle cx="80" cy="80" r={radius}
              fill="transparent"
              stroke={isComplete ? PRIMARY_LIGHT : PRIMARY_CONTAINER}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              filter="url(#ringGlow)"
              style={{
                transition: `stroke-dashoffset ${TICK_MS * 0.6}ms cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease`,
              }}
            />
          </svg>

          {/* Center count */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '48px',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: isComplete ? PRIMARY_LIGHT : '#FFFFFF',
              transition: 'color 0.4s ease',
            }}>
              {count}
            </span>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              color: '#475569',
              marginTop: '4px',
            }}>
              of {TOTAL}
            </span>
          </div>
        </div>

        {/* Status label */}
        <div style={{
          marginTop: '24px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: isComplete ? PRIMARY_LIGHT : PRIMARY_CONTAINER,
          transition: 'color 0.4s ease',
        }}>
          {isComplete ? 'Complete' : 'Marking...'}
        </div>
      </div>

      {/* Feed */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '16px', width: '100%', maxWidth: '320px', minHeight: '280px',
      }}>
        <h3 style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          margin: '0 0 20px 0',
        }}>
          Member Check-Ins
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {feed.length === 0 ? (
            <div style={{
              fontFamily: 'Inter, sans-serif',
              color: '#334155',
              fontSize: '14px',
              marginTop: '10px',
            }}>
              Waiting for check-ins...
            </div>
          ) : (
            feed.map((item, index) => {
              const isNewest = index === 0
              const opacity = isNewest ? 1 : Math.max(0.2, 1 - index * 0.25)
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: isNewest
                      ? PRIMARY_CONTAINER
                      : 'rgba(82, 71, 230, 0.06)',
                    opacity,
                    boxShadow: isNewest
                      ? '0 0 24px rgba(82,71,230,0.45), 0 0 48px rgba(195,192,255,0.1)'
                      : 'none',
                    animation: isNewest
                      ? 'slideInFeed 0.35s cubic-bezier(0.22,1,0.36,1) both'
                      : 'none',
                    transition: 'background-color 0.4s ease, opacity 0.5s ease, box-shadow 0.4s ease',
                  }}
                >
                  {isNewest ? (
                    /* Glowing dot for newest */
                    <div style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: PRIMARY_LIGHT,
                      boxShadow: `0 0 8px ${PRIMARY_LIGHT}`,
                      marginRight: '12px',
                      flexShrink: 0,
                    }} />
                  ) : (
                    /* Tick circle for older items */
                    <svg width="16" height="16" viewBox="0 0 16 16"
                      style={{ marginRight: '10px', flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7"
                        fill="none" stroke={PRIMARY_CONTAINER} strokeWidth="1.5" />
                      <polyline points="4.5,8 7,10.5 11.5,5.5"
                        fill="none" stroke={PRIMARY_CONTAINER}
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    fontWeight: isNewest ? 600 : 400,
                    color: isNewest ? '#FFFFFF' : '#64748b',
                    letterSpacing: isNewest ? '-0.01em' : '0',
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
