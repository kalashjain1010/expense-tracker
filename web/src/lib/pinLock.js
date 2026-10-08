/** Per-user unlock flag for the current browser tab only (PIN itself lives in DB). */

function unlockKey(userId) {
  return `expense_unlocked_${userId || 'anon'}`
}

function skipKey(userId) {
  return `expense_pin_skip_${userId || 'anon'}`
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
}
