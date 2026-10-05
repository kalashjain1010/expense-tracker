/**
 * Vercel serverless entry — same Express app, same domain as the web UI.
 * Routes: /api/*, /auth/*, /health
 */
import app from '../server/src/index.js'

export default app

// Hobby serverless max; keep sheet work lean (see polish:false on login)
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
}
