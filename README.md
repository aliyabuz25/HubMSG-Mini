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

## Cloudflare DNS (error 1033)

**Belirti:** Portainer log’u `HubMinimalWp hazır: http://0.0.0.0:3000` ama tarayıcıda **Error 1033 / Cloudflare Tunnel error**.

Uygulama ve Traefik doğru; kayıt **Cloudflare Tunnel (CNAME)** — edge, hostname’i bu tunnel’da çözemediğinden 1033 döner.

### Seçenek A — Traefik (eventrentlast gibi, önerilen)

1. Cloudflare → **DNS** → `hubmsg` kaydını **Delete**
2. **Add record:**
   - Type: **A**
   - Name: **hubmsg**
   - IPv4: **sunucu public IP** (Portainer/Traefik’in olduğu makine)
   - Proxy: **DNS only (gri bulut)** dene; olmazsa **Proxied (turuncu)**
3. 1–2 dk bekle → `https://hubmsg.octotech.az/api/health`

> Compose zaten `Host(hubmsg.octotech.az)` + `entrypoints=web` tanımlı (commit `0ca1957`). Origin’e giden tek eksik DNS.

### Seçenek B — Cloudflare Tunnel

1. Zero Trust → **Networks → Tunnels** → aktif tunnel → **Public Hostname → Add**
   - `hubmsg.octotech.az` → `http://hubminimalwp:3000`  
     (hubminimalwp compose ile aynı `edge` ağında olmalı)
2. Stack env: `TUNNEL_TOKEN=<tunnel token>`
3. Deploy: `docker compose --profile tunnel up -d`  
   veya Portainer’da stack’i bu profile ile başlat
4. DNS: `hubmsg` tunnel CNAME kaydı kalsın

### Doğrulama

```bash
curl -s https://hubmsg.octotech.az/api/health
# {"ok":true,"maxSlots":3}
```

1033 sürerse: tunnel ingress’inde hostname yoktur veya A record yanlış IP’ye gider.

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
