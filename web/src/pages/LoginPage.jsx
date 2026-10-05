import KharchaLogo from '../components/KharchaLogo'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <KharchaLogo size={56} />
        <h1 className="lock-title">Kharcha</h1>
        <p className="lock-sub">Your money, in your Google Sheet</p>
        {error ? <p className="lock-error">{error}</p> : <p className="lock-spacer" />}
        <button type="button" className="btn primary lock-btn" onClick={login}>
          Continue with Google
        </button>
        <p className="muted tip center" style={{ marginTop: '0.85rem' }}>
          We create a spreadsheet in <strong>your</strong> Drive. You own the data.
        </p>
      </div>
    </div>
  )
}
