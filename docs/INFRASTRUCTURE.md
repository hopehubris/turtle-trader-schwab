# Infrastructure & Deployment Guide

## Local Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup.

Ports used locally:
- Backend: **3010**
- Frontend dev server: **5574**

---

## Production Deployment (Linux / Ubuntu)

This guide assumes a single Linux server (e.g. Ubuntu 22.04). The frontend is served as a static build through nginx; the backend runs as a systemd service.

### Prerequisites

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# nginx
sudo apt-get install -y nginx

# (Optional) PM2 for process management instead of systemd
npm install -g pm2
```

### Directory layout

```
/opt/turtle-trader-schwab/
├── backend/          ← cloned repo backend
│   ├── dist/         ← compiled TypeScript
│   ├── prisma/dev.db ← SQLite database
│   └── .env          ← environment variables
└── frontend/
    └── dist/         ← built React app (served by nginx)
```

### Build

```bash
cd /opt/turtle-trader-schwab

# Backend
cd backend
npm ci --omit=dev
npm run build
npx prisma generate
npx prisma migrate deploy

# Frontend
cd ../frontend
npm ci --omit=dev
npm run build
# Output → frontend/dist/
```

---

## systemd Service

Create `/etc/systemd/system/turtle-trader-schwab.service`:

```ini
[Unit]
Description=Turtle Trader (Schwab) Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/turtle-trader-schwab/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=turtle-trader-schwab

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/opt/turtle-trader-schwab/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable turtle-trader-schwab
sudo systemctl start turtle-trader-schwab

# Check status
sudo systemctl status turtle-trader-schwab

# View logs
sudo journalctl -u turtle-trader-schwab -f
```

---

## Nginx Configuration

Create `/etc/nginx/sites-available/turtle-trader-schwab`:

```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain;

    # Serve React frontend
    root /opt/turtle-trader-schwab/frontend/dist;
    index index.html;

    # SPA fallback — all unknown paths → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/turtle-trader-schwab \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# Certbot will modify the nginx config and set up auto-renewal
```

---

## PM2 Alternative

If you prefer PM2 to systemd:

```bash
cd /opt/turtle-trader-schwab/backend
pm2 start dist/index.js --name turtle-trader-schwab
pm2 save
pm2 startup   # follow the printed command to persist across reboots
```

```bash
pm2 logs turtle-trader-schwab
pm2 restart turtle-trader-schwab
pm2 stop turtle-trader-schwab
```

---

## Environment Variables

All sensitive values live in `backend/.env`. Never commit this file to git (it is in `.gitignore`).

```env
# === REQUIRED ===

# Charles Schwab API
SCHWAB_CLIENT_ID=your-client-id
SCHWAB_CLIENT_SECRET=your-client-secret
SCHWAB_REFRESH_TOKEN=your-refresh-token
SCHWAB_ACCOUNT_NUMBER=your-encrypted-account-number

# === OPTIONAL ===

PORT=3010
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=./logs
```

### Securing credentials

For production, consider using a secrets manager instead of a plain `.env` file:

```bash
# systemd EnvironmentFile with restricted permissions
chmod 600 /opt/turtle-trader-schwab/backend/.env
chown ubuntu:ubuntu /opt/turtle-trader-schwab/backend/.env
```

Or use AWS Secrets Manager, HashiCorp Vault, or similar and inject at runtime.

---

## Database Backups

The SQLite database is a single file at `backend/prisma/dev.db`. Back it up regularly:

```bash
# Manual backup
cp /opt/turtle-trader-schwab/backend/prisma/dev.db \
   /backups/turtle-trader-schwab-$(date +%Y%m%d).db

# Daily cron backup
echo "0 3 * * * ubuntu cp /opt/turtle-trader-schwab/backend/prisma/dev.db \
  /backups/turtle-trader-schwab-\$(date +\%Y\%m\%d).db" \
  | sudo tee /etc/cron.d/turtle-trader-schwab-backup
```

---

## Log Management

Logs are written by winston to `backend/logs/turtle-trader-schwab.log` in JSON format (one object per line). Rotate them to prevent disk fill:

```bash
# /etc/logrotate.d/turtle-trader-schwab
/opt/turtle-trader-schwab/backend/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        systemctl kill -s HUP turtle-trader-schwab
    endscript
}
```

Parse logs with jq:
```bash
# Show all errors
tail -f backend/logs/turtle-trader-schwab.log | jq 'select(.level == "error")'

# Show scan results
cat backend/logs/turtle-trader-schwab.log | jq 'select(.msg == "Daily scan complete")'
```

---

## Port Reference

| Port | Service | Notes |
|------|---------|-------|
| 3010 | Backend API | Proxied through nginx in production |
| 5574 | Frontend dev server | Not used in production; nginx serves static files |
| 80 | nginx HTTP | Redirects to 443 with HTTPS |
| 443 | nginx HTTPS | Serves frontend + proxies /api to backend |

---

## Firewall

In production, only expose 80/443 externally. Block 3010 from external access:

```bash
# UFW example
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3010   # Block direct backend access
sudo ufw enable
```

---

## Upgrade Procedure

```bash
cd /opt/turtle-trader-schwab

# 1. Pull latest code
git pull origin main

# 2. Rebuild backend
cd backend
npm ci --omit=dev
npm run build
npx prisma migrate deploy

# 3. Rebuild frontend
cd ../frontend
npm ci --omit=dev
npm run build

# 4. Restart backend
sudo systemctl restart turtle-trader-schwab

# 5. Verify
sudo systemctl status turtle-trader-schwab
curl http://localhost:3010/api/health
```

---

## Health Monitoring

```bash
# Simple check
curl -s http://localhost:3010/api/health | jq .

# Check scanner last run
curl -s http://localhost:3010/api/signals/scan/status | jq .

# Watch logs
sudo journalctl -u turtle-trader-schwab -f --since "1 hour ago"
```

Integrate with an uptime monitor (e.g. UptimeRobot, Better Uptime) pointing to:
`http://yourdomain.com/api/health`
