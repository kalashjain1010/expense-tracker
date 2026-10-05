import KharchaLogo from '../components/KharchaLogo'
import { loginUrl } from '../lib/api'

const points = [
  'Sign in once with Google',
  'We create a tidy spreadsheet in your Drive',
  'Log spend, income, and card — you own every rupee of data',
]

export default function LoginPage() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  // Real navigation (not fetch) — Google OAuth cannot run as XHR
  const href = loginUrl() || '/auth/google'

  return (
    <div className="lock-screen">
      <div className="lock-card login-card">
        <KharchaLogo size={56} />
        <h1 className="lock-title">Expense Tracker</h1>
        <p className="lock-sub">Money tracking that lives in your Google Sheet</p>

        <ul className="login-points">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        {error ? <p className="lock-error">{error}</p> : null}

        <a className="btn primary lock-btn" href={href}>
          Continue with Google
        </a>
        <p className="muted tip center login-foot">
          Free · Private · Your sheet, your data
        </p>
      </div>
    </div>
  )
}
