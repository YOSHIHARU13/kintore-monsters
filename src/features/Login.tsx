import { useState } from 'react'
import { signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

export function Login() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const login = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        // ポップアップが開けない環境では画面遷移でログインする
        await signInWithRedirect(auth, googleProvider)
        return
      }
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(`ログインできませんでした（${code || '不明なエラー'}）`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <img src="/icon.svg" width={120} height={120} alt="" className="login-icon" />
      <h1>筋トレモンスター</h1>
      <p className="muted">筋トレでモンスターを育てよう</p>
      <button className="btn primary" onClick={login} disabled={busy}>
        Googleでログイン
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
