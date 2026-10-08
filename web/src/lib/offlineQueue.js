const QUEUE_KEY = 'expense_offline_queue_v1'
const EVENT = 'expense-queue'

function read() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list))
  } catch {
    /* storage full */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

function uid() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function getQueue() {
  return read()
}

export function queueCount() {
  return read().length
}

export function subscribeQueue(fn) {
  const handler = () => fn(read())
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function enqueueWrite({ kind, payload }) {
  const item = {
    id: uid(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
  }
  write([...read(), item])
  return item
}

export function removeQueued(id) {
  write(read().filter((x) => x.id !== id))
}

/** Network / connectivity failures worth retrying later. */
export function shouldQueueError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message || err || '')
  return (
    /network|failed to fetch|load failed|offline|took too long|timeout|connection/i.test(msg) ||
    err?.name === 'TypeError'
  )
}

/**
 * Flush pending writes oldest-first.
 * `senders` map: { expense, income, credit } => async (payload) => data
 */
export async function flushQueue(senders) {
  const pending = read()
  if (!pending.length) return { synced: 0, failed: 0, remaining: 0 }

  let synced = 0
  let failed = 0
  const keep = []

  for (const item of pending) {
    const send = senders[item.kind]
    if (!send) {
      keep.push(item)
      failed += 1
      continue
    }
    try {
      await send(item.payload)
      synced += 1
    } catch (err) {
      if (shouldQueueError(err)) {
        keep.push(item)
        failed += 1
      } else {
        failed += 1
      }
    }
  }

  write(keep)
  return { synced, failed, remaining: keep.length }
}
