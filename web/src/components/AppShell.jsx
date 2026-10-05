import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { prefetchTodayEntries } from '../hooks/useKharchaData'
import { useAuth } from '../lib/auth'
import KharchaLogo from './KharchaLogo'

function IconHome({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.2h-3.6V21H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
      />
    </svg>
  )
}

function IconSpend({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M8 12h8" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconIncome({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconCard({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="6.5"
        width="17"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
      />
      <path d="M3.5 10.5h17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
    </svg>
  )
}

const links = [
  { to: '/', end: true, label: 'Home', Icon: IconHome },
  { to: '/expense', label: 'Spend', Icon: IconSpend },
  { to: '/income', label: 'Income', Icon: IconIncome },
  { to: '/credit', label: 'Card', Icon: IconCard },
]

export default function AppShell() {
  const { user, logout } = useAuth()

  useEffect(() => {
    prefetchTodayEntries()
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-link" aria-label="Expense Tracker home">
          <span className="brand-logo-wrap">
            <KharchaLogo size={38} className="brand-logo" />
          </span>
          <span className="brand-wrap">
            <span className="brand">Expense Tracker</span>
            <span className="brand-sub">Your sheet · your money</span>
          </span>
        </Link>
        <div className="topbar-actions">
          {user?.spreadsheetUrl ? (
            <a className="sheet-link" href={user.spreadsheetUrl} target="_blank" rel="noreferrer">
              Sheet
            </a>
          ) : null}
          <button type="button" className="lock-toggle" onClick={logout} aria-label="Sign out" title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M3 12h11M10 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {links.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon">
                  <Icon active={isActive} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
