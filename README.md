# VVKCBT — Hệ thống thi Edge LAN

**VVKCBT** (Võ Văn Kiệt Computer-Based Testing) — hệ thống thi trắc nghiệm LAN cho **THPT Võ Văn Kiệt**.

**Tác giả:** Trương Minh Khiêm

NestJS + React/Vite + PostgreSQL + Socket.io. Triển khai **native** (khuyến nghị) hoặc Docker (tùy chọn).

| Ứng dụng | Title | Vai trò |
|----------|-------|---------|
| **CBT** | Student SPA | Thí sinh làm bài (Chrome kiosk) |
| **CBT - Viewer** | Proctor SPA | Giám thị import ZIP, giám sát |
| **VVKCBT - Composer** | repo `vnu-composer` | Soạn đề, xuất ZIP |

## Cấu trúc

```
apps/api              NestJS backend
apps/web/student      CBT — làm bài
apps/web/proctor      CBT - Viewer — giám sát
packages/shared-types Scoring + types
packages/exam-package-kit  Validate/import ZIP
docker/               Compose production
scripts/              BAT khởi động, bootstrap, backup
docs/                 Runbook, native deploy, browser kiosk
```

## Khởi chạy ngày thi (native — khuyến nghị)

**Máy chủ** (Postgres + Redis + API + nginx):

```
scripts\start-edge-server.bat
```

**Máy giám thị 2 GB** (chỉ trình duyệt):

```
scripts\start-proctor-client.bat
```

Thiết lập lần đầu: `powershell -File scripts\setup-native.ps1` — xem `docs/NATIVE-DEPLOY.md`.

Thí sinh: Chrome kiosk — `docs/BROWSER-KIOSK.md` · `scripts\student-kiosk.bat <IP>`

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

| Dịch vụ | URL dev |
|---------|---------|
| CBT | http://localhost:5173/student/ |
| CBT - Viewer | http://localhost:5174/proctor/ |
| API | http://localhost:3000/api/infra/health |

**Composer:** repo sibling `vnu-composer` → `npm run dev`

## Docker (tùy chọn)

```
scripts\start-proctor-edge-docker.bat
```

Hoặc:

```bash
npm run build
docker compose -f docker/docker-compose.yml up --build
```

- CBT: http://localhost/student/
- CBT - Viewer: http://localhost/proctor/

## Quy trình ngày thi

1. **Composer** — soạn ca, môn, câu hỏi, thí sinh → **Xuất ZIP**
2. **BAT / CBT - Viewer** — import ZIP
3. **SEB** — thí sinh vào `http://<IP_LAN>/student/`
4. **Sau thi** — backup, báo cáo trên CBT - Viewer

Chi tiết: [`docs/RUNBOOK-NGAY-G.md`](docs/RUNBOOK-NGAY-G.md)

## Checklist trước giờ G

```bash
node scripts/edge-bootstrap.mjs
```

## Tài liệu

| File | Nội dung |
|------|----------|
| [`docs/RUNBOOK-NGAY-G.md`](docs/RUNBOOK-NGAY-G.md) | Checklist 24h / 1h / trong giờ thi |
| [`docs/OFFLINE-LAN.md`](docs/OFFLINE-LAN.md) | IP, Docker, font, backup |
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
