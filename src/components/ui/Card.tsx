import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-sm border border-brand-border ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  color = 'blue',
}: {
  label: string
  value: number | string
  color?: 'blue' | 'green' | 'red' | 'gray'
}) {
  const colors = {
    blue: 'bg-brand-primary/5 text-brand-primary',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-brand-secondary text-brand-slate',
  }
  return (
    <div className={`rounded-2xl p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  )
}
