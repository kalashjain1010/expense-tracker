import { useEffect, useState } from 'react'

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function DashboardSkeleton() {
  const [hint, setHint] = useState('Loading your money…')

  useEffect(() => {
        const t1 = setTimeout(() => setHint('Loading your sheet…'), 2200)
    const t2 = setTimeout(() => setHint('Almost there — cold start can be slow'), 7000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="page skeleton-page" aria-busy="true" aria-label="Loading dashboard">
      <div className="load-hint">
        <span className="spinner spinner-ink" />
        <span>{hint}</span>
      </div>
      <div className="hero-block hero-skeleton">
        <Skeleton className="sk-line sk-sm" />
        <Skeleton className="sk-line sk-xl" />
        <Skeleton className="sk-line sk-md" />
      </div>
      <div className="kpi-row">
        <Skeleton className="sk-card" />
        <Skeleton className="sk-card" />
        <Skeleton className="sk-card" />
      </div>
      <Skeleton className="sk-panel" />
      <Skeleton className="sk-panel sk-panel-lg" />
    </div>
  )
}
