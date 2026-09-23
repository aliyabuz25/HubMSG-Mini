const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const pino = require('pino')
const baileys = require('@whiskeysockets/baileys')

const makeWASocket = baileys.default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, isJidGroup } = baileys

const logger = pino({ level: 'silent' })

function normalizeNumber(input, group) {
  let n = String(input || '').replace(/[^\d]/g, '')
  if (!n) throw new Error('geçersiz numara')
  if (n.startsWith('0')) n = '90' + n.slice(1)
  if (n.length === 11 && n.startsWith('5')) n = '90' + n
  if (group) return n.endsWith('@g.us') ? n : `${n}@g.us`
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length < 10) throw new Error('geçersiz numara')
  return `${n}@s.whatsapp.net`
}

class SessionManager {
  static MAX_SLOTS = 3
  constructor(baseDir) {
    this.baseDir = baseDir
    this.slots = new Map()
    fs.mkdirSync(baseDir, { recursive: true })
    for (let i = 1; i <= SessionManager.MAX_SLOTS; i++) {
      this.slots.set(i, { slot: i, status: 'empty', qr: null, qrDataUrl: null, jid: null, phone: null, sock: null, starting: false, saveCreds: null })
    }
  }

  get(slot) {
    if (!Number.isInteger(slot) || slot < 1 || slot > SessionManager.MAX_SLOTS) return null
    return this.slots.get(slot)
  }

  list() {
    return [...this.slots.values()].map((s) => ({
      slot: s.slot,
      status: s.status,
      jid: s.jid || null,
      phone: s.phone || null,
      hasQr: !!s.qrDataUrl
    }))
  }

  authDir(slot) {
    return path.join(this.baseDir, `slot${slot}`)
  }

  async start(slot) {
    const s = this.get(slot)
    if (!s) throw new Error('slot 1-3 arası olmalı')
    if (s.status === 'connected') return { slot, status: 'connected', jid: s.jid }
    if (s.starting) return { slot, status: s.status }
    s.starting = true
    try {
      await this._connect(s)
      return { slot, status: s.status, qr: s.qrDataUrl }
    } finally {
      s.starting = false
    }
  }

  async _connect(s) {
    const dir = this.authDir(s.slot)
    fs.mkdirSync(dir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['HubMinimalWp', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false
    })

    s.sock = sock
    s.saveCreds = saveCreds
    s.status = 'connecting'

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (u) => {
      try {
        if (u.qr) {
          s.status = 'qr'
          s.qr = u.qr
          s.qrDataUrl = await QRCode.toDataURL(u.qr)
        }
        if (u.connection === 'open') {
          s.status = 'connected'
          s.qr = null
          s.qrDataUrl = null
          const id = sock.user?.id || ''
          s.jid = jidNormalizedUser(id)
          s.phone = (sock.user?.jid || id).split(':')[0].split('@')[0]
          console.log(`[slot${s.slot}] bağlandı: ${s.phone}`)
        }
        if (u.connection === 'close') {
          const code = u.lastDisconnect?.error?.output?.statusCode
          const loggedOut = code === DisconnectReason.loggedOut || code === DisconnectReason.badSession
          console.log(`[slot${s.slot}] kapandı code=${code}`)
          if (loggedOut) {
            s.status = 'empty'
            s.qr = null
            s.qrDataUrl = null
            s.jid = null
            s.phone = null
            s.sock = null
            fs.rmSync(this.authDir(s.slot), { recursive: true, force: true })
          } else if (!s.starting) {
            s.status = 'connecting'
            setTimeout(() => this._connect(s).catch((e) => console.error(`[slot${s.slot}]`, e.message)), 1500)
          }
        }
      } catch (e) {
        console.error(`[slot${s.slot}] update`, e.message)
      }
    })
  }

  requireConnected(slot) {
    const s = this.get(slot)
    if (!s) throw new Error('slot 1-3 arası olmalı')
    if (s.status !== 'connected' || !s.sock) throw new Error(`slot${slot} bağlı değil`)
    return s
  }

  async sendText(slot, number, text, isGroup) {
    const s = this.requireConnected(slot)
    const jid = normalizeNumber(number, isGroup)
    const sent = await s.sock.sendMessage(jid, { text })
    return { slot, jid, id: sent?.key?.id || null }
  }

  async sendBulk(slot, numbers, text, isGroup) {
    const results = []
    for (const number of numbers) {
      try {
        results.push(await this.sendText(slot, number, text, isGroup))
      } catch (e) {
        results.push({ number, error: e.message })
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    return { count: results.length, results }
  }

  async sendMedia(slot, number, url, caption, isGroup) {
    const s = this.requireConnected(slot)
    const jid = normalizeNumber(number, isGroup)
    const lower = url.toLowerCase().split('?')[0]
    let content
    if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.mkv')) content = { video: { url }, caption }
    else if (lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.wav')) content = { audio: { url }, mimetype: 'audio/mpeg', ptt: false }
    else if (lower.endsWith('.webp')) content = { sticker: { url } }
    else content = { image: { url }, caption: caption || '' }
    const sent = await s.sock.sendMessage(jid, content)
    return { slot, jid, id: sent?.key?.id || null }
  }

  async logout(slot) {
    const s = this.get(slot)
    if (!s) throw new Error('slot 1-3 arası olmalı')
    try {
      if (s.sock) await s.sock.logout()
    } catch (_) {}
    try {
      if (s.sock) s.sock.ev.removeAllListeners()
      s.sock = null
    } catch (_) {}
    fs.rmSync(this.authDir(slot), { recursive: true, force: true })
    s.status = 'empty'
    s.qr = null
    s.qrDataUrl = null
    s.jid = null
    s.phone = null
    s.saveCreds = null
    return { slot, status: 'empty' }
  }

  async stopAll() {
    for (const s of this.slots.values()) {
      try {
        if (s.sock && s.status === 'connected') await s.sock.end(undefined)
      } catch (_) {}
    }
  }
}

module.exports = SessionManager
