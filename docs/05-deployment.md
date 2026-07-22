# 05 — Deployment

## A. Development (Windows/Mac/Linux)

```bash
npm install
docker compose up -d db        # PostgreSQL (Docker Desktop harus jalan)
npm run db:migrate
npm run db:seed                # admin@geoattend.local / Admin12345
npm run dev                    # http://localhost:3000
```

## B. Rekomendasi Proxmox: VM atau LXC?

Keduanya bisa — pilihan tergantung cara install:

| | **LXC + install native** (rekomendasi) | **VM + Docker Compose** |
| :--- | :--- | :--- |
| RAM idle | ± 400–700 MB | ± 1.5–2 GB (OS penuh) |
| Boot/restore | Detik | Menit |
| Backup vzdump | Sangat cepat (filesystem) | Lebih besar/lambat |
| Docker | ⚠️ Perlu nesting, rawan isu saat update kernel Proxmox — **tidak disarankan produksi** | ✅ Native, stabil |
| Kompleksitas setup | Install Node+Postgres manual (sekali) | `docker compose up`, selesai |

**Saran praktis:**
- **LXC (Debian 12, unprivileged)** + install **native** — paling efisien untuk aplikasi sekelas ini; cocok karena Anda sudah terbiasa kelola Proxmox. Jangan jalankan Docker di dalam LXC untuk produksi.
- Kalau ingin memakai `docker-compose.yml` yang sudah ada persis apa adanya → pakai **VM** (Debian/Ubuntu minimal).

**Spek minimal:** 2 vCPU, 2 GB RAM (LXC bisa 1 GB), disk 20 GB (foto tumbuh ± 100–300 KB/absen — pantau `uploads/`).

## C. Produksi di LXC (native, tanpa Docker)

```bash
# 1. LXC Debian 12, unprivileged, nesting off
apt update && apt install -y curl git nginx postgresql-16 # (atau postgresql dari repo pgdg)

# 2. Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs

# 3. Database
sudo -u postgres psql -c "CREATE USER geoattend WITH PASSWORD 'GANTI_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE geoattend OWNER geoattend;"

# 4. Aplikasi
git clone <repo> /opt/geoattend && cd /opt/geoattend
npm ci
cp .env.example .env.local     # isi DATABASE_URL, BETTER_AUTH_SECRET (openssl rand -base64 32), BETTER_AUTH_URL=https://domain-anda
npm run db:migrate && npm run db:seed
npm run build

# 5. Jalankan sebagai service (systemd)
cat > /etc/systemd/system/geoattend.service <<'EOF'
[Unit]
Description=GeoAttend
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/geoattend
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=-/opt/geoattend/.env.production

[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now geoattend
```

> Catatan: `npm start` membaca `.env.local` via Next.js. Alternatif: salin nilai env ke `/opt/geoattend/.env.production` dan arahkan `EnvironmentFile`.

## D. Produksi dengan Docker (di VM)

```bash
export DB_PASSWORD=<kuat>
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export APP_URL=https://absensi.kusumavision.net
docker compose --profile production up -d --build
```

Volume `pgdata` (database) dan `uploads` (foto) persisten — sertakan dalam backup.

## E. HTTPS — WAJIB

Kamera & GPS browser hanya berfungsi di `localhost` atau **HTTPS**. Opsi:

1. **Nginx + certbot** di depan port 3000:

```nginx
server {
  listen 443 ssl http2;
  server_name absensi.kusumavision.net;
  ssl_certificate     /etc/letsencrypt/live/absensi.../fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/absensi.../privkey.pem;
  client_max_body_size 10m;          # foto base64
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

2. Reverse proxy yang sudah ada (Nginx Proxy Manager/Traefik/Caddy) → arahkan ke IP:3000.

Set `BETTER_AUTH_URL` ke URL HTTPS final — cookie `__Secure-` menuntut HTTPS di produksi.

## F. Environment Variables

| Var | Wajib | Keterangan |
| :--- | :---: | :--- |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/geoattend` |
| `BETTER_AUTH_SECRET` | ✅ | `openssl rand -base64 32` — **unik per lingkungan** |
| `BETTER_AUTH_URL` | ✅ | URL publik aplikasi (untuk cookie/CSRF) |
| `SESSION_EXPIRY_DAYS` | | default 7 |
| `UPLOAD_DIR` | | default `./uploads` |
| `MAX_UPLOAD_SIZE_MB` | | default 5 |
| `NEXT_PUBLIC_DEFAULT_LAT/LNG` | | Pusat peta default |
| `SEED_ADMIN_EMAIL/PASSWORD/NAME` | | Kredensial seed (ganti di produksi!) |

## G. Operasional

- **Health check**: `GET /api/health` → pasang di Uptime Kuma (interval 30–60 detik)
- **Backup harian** (cron): `pg_dump` + rsync/tar folder `uploads/` → simpan keluar host; vzdump LXC/VM mingguan dari Proxmox
- **Update aplikasi**: `git pull && npm ci && npm run db:migrate && npm run build && systemctl restart geoattend` (atau rebuild image Docker). Migrasi bersifat additive sehingga aman dijalankan sebelum restart
- **Rollback**: checkout tag sebelumnya + restart; DB tidak perlu di-rollback (migrasi additive)
- **Log**: `journalctl -u geoattend -f` (native) atau `docker logs -f geoattend-app`

## H. Checklist Go-Live

- [ ] `BETTER_AUTH_SECRET` baru (bukan bawaan dev) & `DB_PASSWORD` kuat
- [ ] Ganti password akun seed `admin@geoattend.local`
- [ ] HTTPS aktif, `BETTER_AUTH_URL` = URL final
- [ ] Geofence & jam kerja SOP dikonfigurasi
- [ ] Uji dari HP: kamera + GPS + absen + live tracking
- [ ] Backup otomatis DB + uploads terjadwal
- [ ] Uptime monitor ke `/api/health`
