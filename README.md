# VVKCBT — Hệ thống thi Edge LAN

**VVKCBT** (Võ Văn Kiệt Computer-Based Testing) — hệ thống thi trắc nghiệm LAN cho **THPT Võ Văn Kiệt**.

**Tác giả:** Trương Minh Khiêm

NestJS + React/Vite + PostgreSQL + Socket.io. Triển khai **native** (Postgres + Redis + nginx).

| Ứng dụng | Title | Vai trò |
|----------|-------|---------|
| **CBT** | Student SPA | Thí sinh làm bài (Chrome kiosk) |
| **CBT - Viewer** | Proctor SPA | Giám thị import ZIP, giám sát |
| **VVKCBT - Composer** | repo `vvkcbt-composer` | Soạn đề, xuất ZIP |

## Cấu trúc

```
apps/api              NestJS backend
apps/web/student      CBT — làm bài
apps/web/proctor      CBT - Viewer — giám sát
packages/shared-types Scoring + types
packages/exam-package-kit  Validate/import ZIP
scripts/              Setup, BAT khởi động, bootstrap, backup
docs/                 Runbook, native deploy, browser kiosk
```

## Setup lần đầu

**Windows (máy chủ):**

```
scripts\setup-windows.bat
```

Chế độ dev (không build/nginx): `scripts\setup-windows.bat --dev`

**Ubuntu:**

```bash
sudo bash scripts/setup-linux.sh
sudo bash scripts/setup-linux.sh --dev
```

Hoặc: `npm run setup` — in hướng dẫn theo OS.

Chi tiết: [`docs/NATIVE-DEPLOY.md`](docs/NATIVE-DEPLOY.md)

## Khởi chạy ngày thi

**Máy chủ** (Postgres + Redis + API + nginx):

```
scripts\start-edge-server.bat
```

(hoặc `scripts\start-proctor-edge.bat` — cùng luồng native)

**Máy giám thị 2 GB** (chỉ trình duyệt):

```
scripts\start-proctor-client.bat
```

Thí sinh: Chrome kiosk — `docs/BROWSER-KIOSK.md` · `scripts\student-kiosk.bat <IP>`

## Development

Yêu cầu: PostgreSQL 16 (+ Redis hoặc `EDGE_LIGHTWEIGHT=true` trong `.env`).

```bash
scripts\setup-windows.bat --dev   # Windows
# hoặc: sudo bash scripts/setup-linux.sh --dev

npm run dev
```

| Dịch vụ | URL dev |
|---------|---------|
| CBT | http://localhost:5173/student/ |
| CBT - Viewer | http://localhost:5174/proctor/ |
| API | http://localhost:3000/api/infra/health |

**Composer:** repo sibling `vvkcbt-composer` → `npm run dev`

## Quy trình ngày thi

1. **Composer** — soạn ca, môn, câu hỏi, thí sinh → **Xuất ZIP**
2. **BAT / CBT - Viewer** — import ZIP
3. **Thí sinh** — `http://<IP_LAN>/student/` (Chrome kiosk)
4. **Sau thi** — backup, báo cáo trên CBT - Viewer

Chi tiết: [`docs/RUNBOOK-NGAY-G.md`](docs/RUNBOOK-NGAY-G.md)

## Checklist trước giờ G

```bash
node scripts/edge-bootstrap.mjs
```

## Tài liệu

| File | Nội dung |
|------|----------|
| [`docs/NATIVE-DEPLOY.md`](docs/NATIVE-DEPLOY.md) | Setup tự động, profile phần cứng |
| [`docs/RUNBOOK-NGAY-G.md`](docs/RUNBOOK-NGAY-G.md) | Checklist 24h / 1h / trong giờ thi |
| [`docs/OFFLINE-LAN.md`](docs/OFFLINE-LAN.md) | IP, font, backup |
| [`docs/SEB-setup.md`](docs/SEB-setup.md) | Cấu hình Safe Exam Browser |
| [`docs/PRODUCTION-SECRETS.md`](docs/PRODUCTION-SECRETS.md) | Bảo mật production |

## Tests

```bash
npm run build
npm run test
npm run kit-sync-check
```

## Demo (chỉ development)

Sau `npm run seed` (dev): SBD 1001–1003, PIN 123456. **Không dùng trên máy thi thật.**
