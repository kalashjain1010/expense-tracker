/** Per-user unlock flag for the current browser tab only (PIN itself lives in DB). */

const PIN_USER_CACHE = 'expense_pin_user_v1'

function unlockKey(userId) {
  return `expense_unlocked_${userId || 'anon'}`
}

function skipKey(userId) {
  return `expense_pin_skip_${userId || 'anon'}`
}

/** Remember last user + hasPin so the lock screen can render on first paint (before /api/me). */
export function cachePinUser(user) {
  if (!user?.id) return
  try {
    localStorage.setItem(
      PIN_USER_CACHE,
      JSON.stringify({ id: user.id, hasPin: Boolean(user.hasPin) }),
    )
  } catch {
    /* private mode */
  }
}

export function getCachedPinUser() {
  try {
    const raw = localStorage.getItem(PIN_USER_CACHE)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.id) return null
    return { id: String(parsed.id), hasPin: Boolean(parsed.hasPin) }
  } catch {
    return null
  }
}

export function clearCachedPinUser() {
  try {
    localStorage.removeItem(PIN_USER_CACHE)
  } catch {
    /* ignore */
  }
}

export function isUnlocked(userId) {
  if (!userId) return true
  try {
    return sessionStorage.getItem(unlockKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markUnlocked(userId) {
  if (!userId) return
  try {
    sessionStorage.setItem(unlockKey(userId), '1')
  } catch {
    /* private mode */
  }
}

export function lockApp(userId) {
  if (!userId) return
  try {
    sessionStorage.removeItem(unlockKey(userId))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('expense-pin-lock'))
}

export function didSkipPinSetup(userId) {
  if (!userId) return false
  try {
    return sessionStorage.getItem(skipKey(userId)) === '1'
  } catch {
    return false
  }
}

export function skipPinSetup(userId) {
  if (!userId) return
  try {
    sessionStorage.setItem(skipKey(userId), '1')
  } catch {
    /* ignore */
  }
}

export function clearPinSession(userId) {
  if (!userId) return
  try {
    sessionStorage.removeItem(unlockKey(userId))
    sessionStorage.removeItem(skipKey(userId))
  } catch {
    /* ignore */
  }
  clearCachedPinUser()
}
