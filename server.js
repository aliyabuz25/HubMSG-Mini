const path = require('path')
const express = require('express')
const SessionManager = require('./sessions')

const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY || ''

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(express.static(path.join(__dirname, 'public')))

const manager = new SessionManager(path.join(__dirname, 'data', 'sessions'))

function auth(req, res, next) {
  if (!API_KEY) return next()
  const key = req.get('x-api-key') || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' })
  next()
}

function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error(err)
      if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || 'error' })
    })
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true, maxSlots: SessionManager.MAX_SLOTS }))

app.get('/api/sessions', (req, res) => res.json({ ok: true, sessions: manager.list() }))

app.post('/api/sessions/:slot/start', auth, wrap(async (req, res) => {
  const slot = Number(req.params.slot)
  const data = await manager.start(slot)
  res.json({ ok: true, ...data })
}))

app.get('/api/sessions/:slot/status', (req, res) => {
  const slot = Number(req.params.slot)
  const s = manager.get(slot)
  if (!s) return res.json({ ok: true, status: 'empty', slot })
  res.json({
    ok: true,
    slot,
    status: s.status,
    jid: s.jid || null,
    phone: s.phone || null,
    qr: s.status === 'qr' ? s.qrDataUrl : null
  })
})

app.delete('/api/sessions/:slot', auth, wrap(async (req, res) => {
  const slot = Number(req.params.slot)
  await manager.logout(Number(req.params.slot))
  res.json({ ok: true })
}))

app.post('/api/send', auth, wrap(async (req, res) => {
  const { slot, number, text, message, group } = req.body || {}
  const body = text || message
  if (!number || !body) return res.status(400).json({ ok: false, error: 'number ve text zorunlu' })
  const result = await manager.sendText(Number(slot) || 1, String(number), String(body), !!group)
  res.json({ ok: true, ...result })
}))

app.post('/api/send/bulk', auth, wrap(async (req, res) => {
  const { slot, numbers, text, message, group } = req.body || {}
  const body = text || message
  const list = Array.isArray(numbers) ? numbers : []
  if (!list.length || !body) return res.status(400).json({ ok: false, error: 'numbers[] ve text zorunlu' })
  const result = await manager.sendBulk(Number(slot) || 1, list, String(body), !!group)
  res.json({ ok: true, ...result })
}))

app.post('/api/send/media', auth, wrap(async (req, res) => {
  const { slot, number, url, caption, group } = req.body || {}
  if (!number || !url) return res.status(400).json({ ok: false, error: 'number ve url zorunlu' })
  const result = await manager.sendMedia(Number(slot) || 1, String(number), String(url), caption ? String(caption) : '', !!group)
  res.json({ ok: true, ...result })
}))

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'not found' }))

app.listen(PORT, () => console.log(`HubMinimalWp hazır: http://0.0.0.0:${PORT}`))

process.on('SIGINT', async () => { await manager.stopAll(); process.exit(0) })
process.on('SIGTERM', async () => { await manager.stopAll(); process.exit(0) })
