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
const TICK_MS = 2000   // total time per person
const DOT_TO_TICK = 1200  // when dot morphs into tick
const PAUSE_MS = 3000

const PRIMARY_LIGHT = '#c3c0ff'
const PRIMARY_CONTAINER = '#5247e6'
const TRACK = '#151b2d'

type Phase = 'entering' | 'active' | 'ticked'

interface FeedItem {
  id: number
  name: string
  phase: Phase
}

// Animated tick checkmark
function Tick({ visible }: { visible: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 18 18"
      style={{
        marginRight: '10px',
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <circle
        cx="9" cy="9" r="8"
        fill="none"
        stroke={PRIMARY_LIGHT}
        strokeWidth="1.5"
        opacity="0.4"
      />
      <polyline
        points="5,9 7.5,11.5 13,6"
        fill="none"
        stroke={PRIMARY_LIGHT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="20"
        strokeDashoffset={visible ? 0 : 20}
        style={{ transition: 'stroke-dashoffset 0.35s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  )
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

    const id = idRef.current++
    const newItem: FeedItem = { id, name: NAMES[count], phase: 'entering' }

    // Prepend new item
    setFeed(prev => [newItem, ...prev].slice(0, 6))

    // Settle into active (dot starts pulsing)
    const t1 = setTimeout(() => {
      setFeed(prev => prev.map(item =>
        item.id === id ? { ...item, phase: 'active' } : item
      ))
    }, 80)

    // Morph dot → tick
    const t2 = setTimeout(() => {
      setFeed(prev => prev.map(item =>
        item.id === id ? { ...item, phase: 'ticked' } : item
      ))
    }, DOT_TO_TICK)

    // Advance to next person
    const t3 = setTimeout(() => {
      setCount(c => c + 1)
    }, TICK_MS)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
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
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.5); opacity: 0.7; }
        }
      `}</style>

      {/* ── Ring ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px', width: '100%', maxWidth: '280px',
      }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>

          {/* Ambient glow */}
          <div style={{
            position: 'absolute', inset: 0,
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
            <circle cx="80" cy="80" r={radius}
              fill="transparent" stroke={TRACK} strokeWidth={strokeWidth} />
            <circle cx="80" cy="80" r={radius}
              fill="transparent"
              stroke={isComplete ? PRIMARY_LIGHT : PRIMARY_CONTAINER}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              filter="url(#ringGlow)"
              style={{
                transition: `stroke-dashoffset ${TICK_MS * 0.5}ms cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease`,
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

      {/* ── Feed ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '16px', width: '100%', maxWidth: '320px', minHeight: '300px',
      }}>
        <h3 style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          margin: '0 0 16px 0',
        }}>
          Member Check-Ins
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
              const isActive = item.phase === 'active'
              const isTicked = item.phase === 'ticked'
              const isEntering = item.phase === 'entering'

              // Opacity recedes as items age below the active one
              const ageOpacity = index === 0
                ? 1
                : Math.max(0.18, 1 - index * 0.2)

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '11px 14px',
                    borderRadius: '14px',
                    // Active = solid indigo pill. Ticked/older = ghost tint.
                    backgroundColor: (isEntering || isActive)
                      ? PRIMARY_CONTAINER
                      : 'rgba(82, 71, 230, 0.07)',
                    opacity: ageOpacity,
                    boxShadow: (isEntering || isActive)
                      ? '0 0 24px rgba(82,71,230,0.5), 0 0 48px rgba(195,192,255,0.08)'
                      : 'none',
                    animation: isEntering
                      ? 'slideDown 0.32s cubic-bezier(0.22,1,0.36,1) both'
                      : 'none',
                    transition: 'background-color 0.5s ease, box-shadow 0.5s ease, opacity 0.5s ease',
                  }}
                >
                  {/* Left indicator: pulsing dot (active) or tick (ticked) */}
                  {(isEntering || isActive) ? (
                    <div style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: PRIMARY_LIGHT,
                      boxShadow: `0 0 8px ${PRIMARY_LIGHT}`,
                      marginRight: '12px',
                      flexShrink: 0,
                      animation: isActive ? 'dotPulse 1s ease-in-out infinite' : 'none',
                    }} />
                  ) : (
                    <Tick visible={isTicked} />
                  )}

                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    fontWeight: (isEntering || isActive) ? 600 : 400,
                    color: (isEntering || isActive) ? '#FFFFFF' : '#64748b',
                    letterSpacing: (isEntering || isActive) ? '-0.01em' : '0',
                    transition: 'color 0.4s ease, font-weight 0.3s ease',
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
