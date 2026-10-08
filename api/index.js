/**
 * Vercel serverless entry — same Express app, same domain as the web UI.
 * Routes: /api/*, /auth/*, /health
 */
let app
let bootError = null
try {
  app = (await import('../server/src/index.js')).default
} catch (err) {
  bootError = err
  console.error('API boot failed:', err)
}

export default function handler(req, res) {
  if (bootError || !app) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(`BOOT_ERROR\n${bootError?.stack || bootError || 'unknown'}`)
    return
  }
  return app(req, res)
}

// Hobby serverless max; keep sheet work lean (see polish:false on login)
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
}
