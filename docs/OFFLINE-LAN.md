# VVKCBT — Triển khai Offline LAN

Hệ thống thi **không cần internet** sau khi chuẩn bị. Chỉ cần LAN nội bộ giữa máy chủ và máy thí sinh.

## Kiến trúc (native)

```
[Máy soạn] VVKCBT - Composer → exam-package.zip
                    ↓ USB/LAN
[Máy chủ] Postgres + Redis + API + nginx (native)
          CBT - Viewer (giám thị — có thể máy 2GB riêng)
                    ↓ LAN
[Máy thí sinh] Chrome kiosk → CBT (Student)
```

Chi tiết: `docs/NATIVE-DEPLOY.md` · Profile A (server + client 2GB) · Profile C (single node 4–8GB)

## Máy chủ

### Phần mềm

- Windows 10/11
- Node.js 20 LTS
- PostgreSQL 16
- Redis 7 (hoặc `EDGE_LIGHTWEIGHT=true`)
- nginx portable trong `tools/nginx/`

### Cấu hình `.env` production

```env
NODE_ENV=production
DEPLOY_PROFILE=native
SCHOOL_NAME=THPT Võ Văn Kiệt - Cà Mau
VITE_SCHOOL_NAME=THPT Võ Văn Kiệt - Cà Mau
VITE_UI_MODE=production
VITE_EXAM_LOCK_MODE=browser
EDGE_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.1.50
JWT_SECRET=<chuỗi ngẫu nhiên ≥32 ký tự>
ANONYMIZATION_SALT=<chuỗi ngẫu nhiên>
AUDIO_ENCRYPTION_KEY=<32 ký tự hex>
```

Thay `192.168.1.50` bằng IP LAN thực tế của máy chủ.

### Khởi động

```
scripts\start-edge-server.bat
```

Máy giám thị 2 GB (không chạy DB/API):

```
scripts\start-proctor-client.bat
```

### Kiểm tra

```bash
node scripts/edge-bootstrap.mjs
```

## Máy thí sinh

- Chrome hoặc Edge
- Shortcut kiosk: `scripts\student-kiosk.bat <IP>` — xem `docs/BROWSER-KIOSK.md`
- SEB tùy chọn: `docs/SEB-setup.md`

## URL

| Vai trò | URL |
|---------|-----|
| Thí sinh | `http://<IP>/student/` |
| Giám thị | `http://<IP>/proctor/` |
| Health | `http://<IP>/api/infra/health` |

## Docker (tùy chọn)

Nếu máy đủ RAM và đã cài Docker Desktop:

```
scripts\start-proctor-edge-docker.bat
```

## Bảo mật LAN

- Không mở port ra internet
- Đổi mật khẩu giám thị mặc định
- Giữ `JWT_SECRET` bí mật — xem `docs/PRODUCTION-SECRETS.md`
