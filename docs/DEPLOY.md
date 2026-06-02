# Deployment & CI/CD

API production server: **152.42.240.101** (DigitalOcean, Singapore, Ubuntu 2vCPU/8GB).
Pipeline: `.github/workflows/ci-cd.yml` — CI on every push/PR, auto-deploy on push to `master`.

## How it works

1. **CI job** (`ci`): `npm ci` → `prisma generate` → smoke test that boots the app and mounts every route. Fails the build if wiring breaks.
2. **CD job** (`deploy`): runs only after CI passes, on `master` push. SSHes into the server, pulls the latest code, rebuilds the Docker Compose stack, and runs `prisma db push` to sync the schema.

## One-time server setup

```bash
ssh root@152.42.240.101

# Docker + compose plugin
curl -fsSL https://get.docker.com | sh

# Clone the repo (use a deploy key or HTTPS token so `git pull` works unattended)
git clone https://github.com/professorDeveloper/oqyol-backend.git ~/rideshare-backend
cd ~/rideshare-backend

# Create the production .env (NOT committed). Important values:
#   NODE_ENV=production
#   OTP_DEMO_MODE=false
#   strong JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / JWT_REGISTER_SECRET (>=16 chars)
#   real ESKIZ_* (SMS) and R2_* (uploads) credentials
#   CORS_ORIGINS=<your app domains>
# DATABASE_URL / REDIS_* are overridden by docker-compose to point at the containers.
nano .env

# First boot
docker compose up -d --build
docker compose exec -T api npx prisma db push   # create tables
docker compose exec -T api npm run prisma:seed   # optional: regions/routes
```

### Deploy SSH key
Generate a key pair the Action will use, and authorize the public half on the server:

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
ssh-copy-id -i deploy_key.pub root@152.42.240.101   # or append deploy_key.pub to ~/.ssh/authorized_keys
```

## Required GitHub secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value |
|---|---|
| `SSH_HOST` | `152.42.240.101` |
| `SSH_USER` | `root` (or the deploy user) |
| `SSH_PRIVATE_KEY` | contents of the `deploy_key` private key file |
| `DEPLOY_PATH` | `/root/rideshare-backend` (the clone path on the server) |
| `SSH_PORT` | `22` (optional; defaults to 22) |

After secrets are set, every push to `master` deploys automatically. To deploy manually you can re-run the workflow from the Actions tab.

## Recommended (production hardening)
- Put Nginx in front with HTTPS (Let's Encrypt / certbot) and proxy to `127.0.0.1:3000`.
- Restrict the Postgres/Redis published ports (bind to `127.0.0.1` in `docker-compose.yml`).
- Set a real `CORS_ORIGINS` instead of `*`.
