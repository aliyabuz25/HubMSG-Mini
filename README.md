# HubMinimalWp

Minimal WhatsApp hub — Baileys + Bootstrap admin panel. En fazla **3 numara**, QR ile bağlanma, mesaj gönderme API'leri. Portainer / Traefik (443) için hazır.

**Domain:** https://wa.octotech.az

## Özellikler

- 3 slot (en fazla 3 WhatsApp numarası)
- QR ile oturum ekleme / silme
- Metin, medya (URL) ve toplu gönderim
- Light flat Bootstrap UI + sidebar
- Traefik `edge` network + **entrypoints=web** (`Host(wa.octotech.az)`) — erent ile aynı
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
curl -X POST http://localhost:3000/api/sessions/1/start

curl -X POST http://localhost:3000/api/send \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"number":"905xxxxxxxxx","text":"merhaba"}'

curl -X POST http://localhost:3000/api/send/bulk \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"numbers":["905xx","905xx"],"text":"selam"}'

curl -X POST http://localhost:3000/api/send/media \
  -H 'Content-Type: application/json' \
  -d '{"slot":1,"number":"905xx","url":"https://…/photo.jpg","caption":"selam"}'
```

Production: `https://wa.octotech.az/api/health`  
`API_KEY` tanımlıysa header: `X-API-Key: <key>`

## Cloudflare DNS (error 1033)

**Belirti:** Portainer log’u `HubMinimalWp hazır` ama tarayıcıda **Error 1033** → kayıt Tunnel’da; edge hostname’i çözemiyor.

### Traefik 443 (önerilen)

1. Cloudflare → DNS → eski `hubmsg` / `wa` Tunnel kaydını **sil/değiştir**
2. **Add record:**
   - Type: **A**
   - Name: **wa**
   - IPv4: **sunucu public IP** (Traefik :443)
   - Proxy: **Proxied (turuncu)** — origin TLS Full (strict) ise; Flexible ise gri de olur
3. Traefik’te `websecure` (443) açık ve TLS resolver/cert tanımlı olmalı
4. Test: `https://wa.octotech.az/api/health` → `{"ok":true,"maxSlots":3}`

Eski `hubmsg.octotech.az` kullanıyorsan aynı adımlar: A kaydı `hubmsg` → sunucu IP.

### Alternatif: Cloudflare Tunnel

1. Zero Trust → Public Hostname: `wa.octotech.az` → `http://hubminimalwp:3000`
2. Stack env: `TUNNEL_TOKEN=…`
3. `docker compose --profile tunnel up -d`
4. DNS: `wa` → tunnel CNAME (hostname tunnel config’te görünmeli)

## 404 page not found

Traefik/cloudflared Host eşleşmiyor. Kontrol:

1. Stack redeploy (labels için)
2. İstek Host = **`wa.octotech.az`** (hubmsg değil)
3. Origin’i dene: `curl -H 'Host: wa.octotech.az' http://SUNUCU_IP/` ve `https://…`
4. DNS: **A `wa` → sunucu IP** (Tunnel CNAME ise 1033/404 olur)
5. Tunnel kullanıyorsan Zero Trust hostname birebir `wa.octotech.az` olmalı
6. Traefik `web` (:80) **veya** `websecure` (:443) açık olmalı — compose her ikisini de dener

```bash
curl -s https://wa.octotech.az/api/health
# {"ok":true,"maxSlots":3}
```

## Docker / Portainer

```bash
# Ön koşullar (sunucu):
#   - network: edge (external — mevcut olmalı, compose oluşturmaz)
#   - traefik entrypoint: websecure (443) — edge ağında
#   - /datastore/hubminimal/data
#   - DNS: wa.octotech.az → sunucu IP (proxied A)
```

1. Repo: `https://github.com/aliyabuz25/HubMSG-Mini.git`
2. Portainer → **Stacks → Add stack → Repository**
   - Web URL: `https://github.com/aliyabuz25/HubMSG-Mini.git`
   - Compose path: `docker-compose.yml`
   - Stack name: `hubminimalwp`
   - **Pull latest images: OFF** (image registry’de yok; compose `build: .` kullanır)
3. Deploy (Portainer Dockerfile’ı build eder)
4. Redeploy’da da pull kapalı kalsın — yoksa `pull access denied for hubminimalwp`

Compose, Traefik **443 (websecure)** üzerinde `Host(wa.octotech.az)` → container `:3000`.

## Yapı

```
.
├── server.js            # Express API
├── sessions.js          # Baileys slot yönetimi (max 3)
├── public/index.html    # Admin panel (sidebar)
├── Dockerfile
├── docker-compose.yml   # Portainer + Traefik websecure + optional tunnel
├── .env.example
└── portainer-template.json
```

## Güvenlik

- `node_modules/`, `data/`, `.env` gitignore'da
- Session anahtarları `data/sessions/` içinde (volume)
- Üretimde `API_KEY` set edin
