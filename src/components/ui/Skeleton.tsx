import type { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
}

/** Single shimmer bar */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
    />
  )
}

/** Full member-row skeleton (matches UnitMembers / AdminServiceDetail rows) */
export function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-dark last:border-0">
      <Skeleton className="size-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

/** Card-sized skeleton for event/service cards */
export function ServiceCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-dark border border-border-dark p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-36" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  )
}

/** Stat card skeleton */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-dark border border-border-dark p-4 space-y-2">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="h-7 w-10" />
    </div>
  )
}

/** Org card skeleton */
export function OrgCardSkeleton() {
  return (
    <div className="bg-surface-dark p-5 rounded-2xl border border-border-dark flex items-center gap-4">
      <Skeleton className="size-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

/** A page-level loading wrapper with branded feel */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background-dark">
      <div className="relative size-14">
        <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
        <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-2 flex items-center justify-center">
          <img src="/logo.png" alt="" className="size-7 object-contain opacity-80" />
        </div>
      </div>
      {label && (
        <p className="text-2xs font-bold uppercase tracking-spaced text-slate-600">{label}</p>
      )}
    </div>
  )
}

/** Stacked list of member row skeletons */
export function MemberListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <MemberRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** Wraps children with a consistent section skeleton block */
export function SkeletonSection({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>
}
