# HubMinimalWp

Minimal WhatsApp hub — Baileys + Bootstrap admin panel. En fazla **3 numara**, QR ile bağlanma, mesaj gönderme API'leri. Portainer / Traefik için hazır.

**Domain:** https://hubmsg.octotech.az

## Özellikler

- 3 slot (en fazla 3 WhatsApp numarası)
- QR ile oturum ekleme / silme
- Metin, medya (URL) ve toplu gönderim
- Light flat Bootstrap UI + sidebar
- Traefik `edge` network etiketleri (`Host(hubmsg.octotech.az)`)
- Opsiyonel `API_KEY` koruması
- Opsiyonel Cloudflare Tunnel (`--profile tunnel`)

## Hızlı Başlangıç (lokal)

```bash
npm install
npm start
# → http://localhost:3000
```

## API

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/health` | Sağlık |
| GET | `/api/sessions` | Slot listesi |
| POST | `/api/sessions/:slot/start` | QR başlat (slot 1-3) |
| GET | `/api/sessions/:slot/status` | Durum + QR |
| DELETE | `/api/sessions/:slot` | Çıkış / sil |
| POST | `/api/send` | Tek mesaj |
| POST | `/api/send/bulk` | Toplu metin |
| POST | `/api/send/media` | Medya (URL) |

### Örnekler

```bash
# QR başlat
curl -X POST http://localhost:3000/api/sessions/1/start

# Mesaj gönder
curl -X POST http://localhost:3000/api/send \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"number":"905xxxxxxxxx","text":"merhaba"}'

# Toplu
curl -X POST http://localhost:3000/api/send/bulk \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"numbers":["905xx","905xx"],"text":"selam"}'

# Medya
curl -X POST http://localhost:3000/api/send/media \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"number":"905xx","url":"https://…/photo.jpg","caption":"selam"}'
```

Production: `https://hubmsg.octotech.az/api/health`  
`API_KEY` tanımlıysa header: `X-API-Key: <key>`

## Cloudflare DNS (error 1033 düzeltme)

`hubmsg.octotech.az` **error 1033** veriyorsa kayıt **Tunnel (CNAME)** yapılmış; tunnel ingress'inde hostname yoktur.

**Doğru (Traefik — önerilen):**

1. Cloudflare → DNS → `hubmsg` kaydını **sil**
2. **A** kaydı ekle: name `hubmsg`, value **sunucu IP** (eventrentlast ile aynı origin), **Proxy: ON (bulut)**
3. Traefik `entrypoints=web` ile Host routing zaten compose'ta
4. Portainer stack'i deploy et → https://hubmsg.octotech.az

**Alternatif (Cloudflare Tunnel):**

1. Zero Trust → Networks → Tunnels → Public Hostname:
   - `hubmsg.octotech.az` → `http://hubminimalwp:3000`
2. Stack'e `TUNNEL_TOKEN` ekle
3. Deploy: compose profile `tunnel` ile cloudflared ayağa kalkar
4. DNS: Tunnel CNAME kaydı (hostname tunnel config'te görünmeli)

## Docker / Portainer

```bash
# Ön koşullar (sunucu):
#   - network: edge (yoksa compose oluşturur)
#   - traefik (entrypoint: web) — aynı edge ağında olmalı
#   - /datastore/hubminimal/data
#   - DNS: hubmsg.octotech.az → sunucu IP (proxied A, Tunnel DEĞİL)
```

1. Repo'yu GitHub'a itin: `https://github.com/aliyabuz25/HubMSG-Mini.git`
2. Portainer → **Stacks → Add stack → Repository**
   - Web URL: `https://github.com/aliyabuz25/HubMSG-Mini.git`
   - Compose path: `docker-compose.yml`
   - Stack name: `hubminimalwp`
3. Deploy

Compose, Traefik ile `Host(hubmsg.octotech.az)` üzerinden 3000 portuna yönlendirir (eventrentlast ile aynı `edge` + `web` pattern).

## Yapı

```
.
├── server.js            # Express API
├── sessions.js          # Baileys slot yönetimi (max 3)
├── public/index.html    # Admin panel (sidebar)
├── Dockerfile
├── docker-compose.yml   # Portainer + Traefik (+ optional tunnel)
├── .env.example
└── portainer-template.json
```

## Güvenlik

- `node_modules/`, `data/`, `.env` gitignore'da
- Session anahtarları `data/sessions/` içinde (volume)
- Üretimde `API_KEY` set edin
