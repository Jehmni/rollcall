import React, { useState, useEffect } from 'react';

const DUMMY_NAMES = [
  "Sarah Mitchell", "James Okonkwo", "Priya Sharma", "Marcus Chen",
  "Amara Diallo", "Liam Novak", "Fatima Al-Rashid", "Kenji Tanaka",
  "Elena Volkov", "David Park", "Aisha Bello", "Thomas Wright"
];

const TOTAL_COUNT = 24;
const INTERVAL_MS = 350;
const PAUSE_MS = 2500;

export default function LiveCounterRing() {
  const [count, setCount] = useState(0);
  const [recentFeed, setRecentFeed] = useState<string[]>([]);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (count < TOTAL_COUNT) {
      timer = setTimeout(() => {
        setCount(c => c + 1);
        const name = DUMMY_NAMES[count % DUMMY_NAMES.length];
        setRecentFeed(prev => [name, ...prev].slice(0, 4));
      }, INTERVAL_MS);
    } else {
      timer = setTimeout(() => {
        setCount(0);
        setRecentFeed([]);
      }, PAUSE_MS);
    }
    
    return () => clearTimeout(timer);
  }, [count]);

  const radius = 70;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - count / TOTAL_COUNT);
  
  const isComplete = count === TOTAL_COUNT;
  
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
      padding: '20px 0'
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=DM+Sans:wght@400;500;700&display=swap');
          
          @keyframes slideInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      
      {/* Ring Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        width: '100%',
        maxWidth: '280px'
      }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="#1B2D5B"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke={isComplete ? '#34C759' : '#5B8CD4'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease' }}
            />
          </svg>
          
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '48px',
              fontWeight: 500,
              lineHeight: 1,
              color: isComplete ? '#34C759' : '#FFFFFF',
              transition: 'color 0.3s ease'
            }}>
              {count}
            </span>
            <span style={{ fontSize: '13px', color: '#7A8BA8', marginTop: '4px', fontWeight: 500 }}>
              of {TOTAL_COUNT}
            </span>
          </div>
        </div>
        
        <div style={{
          marginTop: '24px',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: isComplete ? '#34C759' : '#5B8CD4',
          transition: 'color 0.3s ease'
        }}>
          {isComplete ? 'COMPLETE' : 'MARKING...'}
        </div>
      </div>

      {/* Feed Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        width: '100%',
        maxWidth: '320px',
        minHeight: '280px'
      }}>
        <h3 style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#7A8BA8',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 20px 0'
        }}>
          Recent check-ins
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {recentFeed.length === 0 ? (
            <div style={{ color: '#7A8BA8', fontSize: '14px', fontStyle: 'italic', marginTop: '10px' }}>
              Waiting for check-ins...
            </div>
          ) : (
            recentFeed.map((name, index) => {
              const isNewest = index === 0;
              const opacity = 1 - (index * 0.2);
              
              return (
                <div key={`${name}-${count - index}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: isNewest ? 'rgba(52, 199, 89, 0.08)' : 'transparent',
                  opacity: Math.max(0.2, opacity),
                  transition: 'all 0.3s ease',
                  animation: 'slideInDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isNewest ? '#34C759' : '#5B8CD4',
                    marginRight: '12px',
                    boxShadow: isNewest ? '0 0 8px rgba(52, 199, 89, 0.5)' : 'none'
                  }} />
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: isNewest ? 700 : 500, 
                    color: isNewest ? '#FFFFFF' : '#E2E8F0' 
                  }}>
                    {name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
