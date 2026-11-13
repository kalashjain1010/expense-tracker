import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { prefetchTodayEntries } from '../hooks/useKharchaData'
import { useIsDesktop } from '../hooks/useIsMobile'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { useAuth } from '../lib/auth'
import { lockApp } from '../lib/pinLock'
import { getLayoutMode, setLayoutMode } from '../lib/prefs'
import { getTheme, toggleTheme } from '../lib/theme'
import ConfirmDialog from './ConfirmDialog'
import KharchaLogo from './KharchaLogo'
import OfflineBanner from './OfflineBanner'
import PinSetup from './PinSetup'

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
      <path d="M12 4v11" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
      <path
        d="M8 11.5 12 15.5l4-4"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19h14" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
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

function IconSheet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 8.5h16M9 8.5v12.5M14 8.5v12.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const links = [
  { to: '/', end: true, label: 'Home', Icon: IconHome },
  { to: '/expense', label: 'Spend', Icon: IconSpend },
  { to: '/income', label: 'Income', Icon: IconIncome },
  { to: '/credit', label: 'Card', Icon: IconCard },
]

function NavItems({ className }) {
  return links.map(({ to, end, label, Icon }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      replace
      className={({ isActive }) => `${className} ${isActive ? 'active' : ''}`.trim()}
    >
      {({ isActive }) => (
        <>
          <span className="nav-icon">
            <Icon active={isActive} />
          </span>
          <span className="nav-label">{label}</span>
        </>
      )}
    </NavLink>
  ))
}

export default function AppShell() {
  const { user, logout, refresh } = useAuth()
  const [confirmOut, setConfirmOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setThemeState] = useState(() => getTheme())
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [layoutMode, setLayoutModeState] = useState(() => getLayoutMode())
  const wideViewport = useIsDesktop()
  const useDesktopChrome = wideViewport && layoutMode === 'desktop'
  const swipeTabsRef = useSwipeTabs({ enabled: !useDesktopChrome })

  useEffect(() => {
    prefetchTodayEntries()
  }, [])

  async function confirmLogout() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
      setConfirmOut(false)
    }
  }

  function handleTheme() {
    setThemeState(toggleTheme())
  }

  function preferMobile() {
    setLayoutModeState(setLayoutMode('mobile'))
  }

  function preferDesktop() {
    setLayoutModeState(setLayoutMode('desktop'))
  }

  if (showPinSetup && user && !user.hasPin) {
    return (
      <PinSetup
        userId={user.id}
        onDone={async ({ hasPin }) => {
          setShowPinSetup(false)
          if (hasPin) await refresh()
        }}
      />
    )
  }

  const themeBtn = (
    <button
      type="button"
      className="lock-toggle"
      onClick={handleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 13.5A7.5 7.5 0 1 1 10.5 4 6 6 0 0 0 20 13.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )

  const lockBtn = user?.hasPin ? (
    <button
      type="button"
      className="lock-toggle"
      onClick={() => lockApp(user.id)}
      aria-label="Lock app"
      title="Lock"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  ) : (
    <button
      type="button"
      className="lock-toggle"
      onClick={() => setShowPinSetup(true)}
      aria-label="Set app PIN"
      title="Set PIN"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="3 2"
        />
      </svg>
    </button>
  )

  const signOutBtn = (
    <button
      type="button"
      className="lock-toggle"
      onClick={() => setConfirmOut(true)}
      aria-label="Sign out"
      title="Sign out"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M3 12h11M10 8l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )

  return (
    <div className={`app-shell ${useDesktopChrome ? 'is-desktop' : 'is-mobile'}`}>
      <aside className="side-nav" aria-label="Primary">
        <Link to="/" replace className="side-brand" aria-label="Expense Tracker home">
          <KharchaLogo size={36} />
          <span>
            <strong>Expense Tracker</strong>
            <em>Your sheet · your money</em>
          </span>
        </Link>
        <nav className="side-nav-links">
          <NavItems className="side-nav-item" />
        </nav>
        <div className="side-nav-foot">
          {user?.spreadsheetUrl ? (
            <a
              className="side-nav-tool"
              href={user.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open sheet
            </a>
          ) : null}
          <button type="button" className="side-nav-tool" onClick={preferMobile}>
            Mobile layout
          </button>
          <button type="button" className="side-nav-tool" onClick={handleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {user?.hasPin ? (
            <button type="button" className="side-nav-tool" onClick={() => lockApp(user.id)}>
              Lock
            </button>
          ) : (
            <button type="button" className="side-nav-tool" onClick={() => setShowPinSetup(true)}>
              Set PIN
            </button>
          )}
          <button type="button" className="side-nav-tool" onClick={() => setConfirmOut(true)}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <Link to="/" replace className="brand-link" aria-label="Expense Tracker home">
            <span className="brand-logo-wrap">
              <KharchaLogo size={38} className="brand-logo" />
            </span>
            <span className="brand-wrap">
              <span className="brand">Expense Tracker</span>
              <span className="brand-sub">Your sheet · your money</span>
            </span>
          </Link>
          <div className="topbar-actions">
            {wideViewport && layoutMode === 'mobile' ? (
              <button type="button" className="layout-switch-btn" onClick={preferDesktop}>
                Desktop
              </button>
            ) : null}
            {user?.spreadsheetUrl ? (
              <a
                className="sheet-chip"
                href={user.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                title="Open Google Sheet"
              >
                <IconSheet />
                <span>Sheet</span>
              </a>
            ) : null}
            {lockBtn}
            {themeBtn}
            {signOutBtn}
          </div>
        </header>

        <OfflineBanner />

        <main className="main main-swipe-host">
          <div className="main-swipe-pane" ref={swipeTabsRef}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottom-nav dock" aria-label="Primary">
        <NavItems className="nav-item" />
      </nav>

      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        body="You’ll leave this device. Cached data on this browser will be cleared."
        confirmLabel={signingOut ? 'Signing out…' : 'Sign out'}
        cancelLabel="Stay"
        danger
        onCancel={() => !signingOut && setConfirmOut(false)}
        onConfirm={confirmLogout}
      />
    </div>
  )
}
