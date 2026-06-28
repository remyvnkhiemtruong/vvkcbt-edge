#!/usr/bin/env bash
# VVKCBT — Setup tự động Ubuntu (native, không Docker)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEV_MODE=false
for arg in "$@"; do
  case "$arg" in
    --dev) DEV_MODE=true ;;
  esac
done

need_sudo() {
  if [[ "$EUID" -ne 0 ]]; then
    echo "[LOI] Can quyen sudo cho buoc: $1"
    echo "      Chay: sudo bash scripts/setup-linux.sh $*"
    exit 1
  fi
}

test_port() {
  timeout 1 bash -c "echo >/dev/tcp/127.0.0.1/$1" 2>/dev/null
}

echo "[1/9] Cap nhat apt va cai phu thuoc he thong..."
need_sudo "apt install"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release nginx redis-server

echo "[2/9] Cai PostgreSQL 16..."
if ! command -v psql >/dev/null 2>&1; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-16 postgresql-contrib-16
fi
systemctl enable --now postgresql redis-server nginx

echo "[3/9] Cai Node.js 20..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node: $(node -v)"

echo "[4/9] Tao database vnu_exam..."
sudo -u postgres env PGUSER=postgres PGDATABASE=postgres node "$ROOT/scripts/sql/init-native-db.mjs"

echo "[5/9] Cau hinh .env..."
ENV_NEW=0
if [[ ! -f "$ROOT/.env" && -f "$ROOT/.env.example" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  ENV_NEW=1
fi
if [[ "$ENV_NEW" == "1" ]]; then
  node "$ROOT/scripts/generate-setup-secrets.mjs" "$ROOT/.env"
fi
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$LAN_IP" ]]; then LAN_IP="127.0.0.1"; fi
ORIGINS="http://localhost,http://127.0.0.1,http://${LAN_IP},http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
if grep -q '^EDGE_ORIGINS=' "$ROOT/.env" 2>/dev/null; then
  sed -i "s|^EDGE_ORIGINS=.*|EDGE_ORIGINS=${ORIGINS}|" "$ROOT/.env"
else
  echo "EDGE_ORIGINS=${ORIGINS}" >> "$ROOT/.env"
fi
if ! test_port 6379; then
  if grep -q '^EDGE_LIGHTWEIGHT=' "$ROOT/.env" 2>/dev/null; then
    sed -i 's|^EDGE_LIGHTWEIGHT=.*|EDGE_LIGHTWEIGHT=true|' "$ROOT/.env"
  else
    echo 'EDGE_LIGHTWEIGHT=true' >> "$ROOT/.env"
  fi
fi

if [[ "$DEV_MODE" != "true" ]]; then
  if grep -q '^NODE_ENV=' "$ROOT/.env" 2>/dev/null; then
    sed -i 's|^NODE_ENV=.*|NODE_ENV=production|' "$ROOT/.env"
  else
    echo 'NODE_ENV=production' >> "$ROOT/.env"
  fi
fi

echo "[6/9] npm install..."
npm install

if [[ "$DEV_MODE" == "true" ]]; then
  echo "[7-8/9] Che do --dev: bo qua build production va nginx site."
else
  echo "[7/9] npm run build..."
  npm run build

  echo "[8/9] Cau hinh nginx..."
  ROOT_SLASH="${ROOT//\\//}"
  sed "s|__VNU_ROOT__|${ROOT_SLASH}|g" "$ROOT/scripts/nginx-native.conf" > /etc/nginx/sites-available/vvkcbt
  ln -sf /etc/nginx/sites-available/vvkcbt /etc/nginx/sites-enabled/vvkcbt
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

echo "[9/9] Migration + seed giam thi..."
npm run migration:run
node "$ROOT/scripts/seed-proctor-user.mjs" proctor proctor123

echo ""
echo "========================================"
echo "  VVKCBT setup hoan tat (Ubuntu)"
echo "========================================"
if [[ "$DEV_MODE" == "true" ]]; then
  echo "  Dev: npm run dev"
else
  echo "  Student: http://${LAN_IP}/student/"
  echo "  Proctor: http://${LAN_IP}/proctor/"
  echo "  API:     npm run start:prod -w @vnu/api"
fi
echo "  Proctor login: proctor / proctor123 (dev — production: set PROCTOR_PASSWORD_HASH)"
echo "  Chua cau hinh ADMIN_PASSWORD_HASH/PROCTOR_PASSWORD_HASH/COMPOSER_PASSWORD_HASH — chay: node scripts/hash-password.mjs <mat-khau> roi dan vao .env truoc khi thi that"
echo "  Check: node scripts/edge-bootstrap.mjs"
echo "========================================"
