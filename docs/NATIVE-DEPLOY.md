# VVKCBT — Triển khai Native

Hệ thống chạy **native**: PostgreSQL + Redis (tùy chọn) + Node API + nginx. Không dùng Docker.

## Hai profile phần cứng

| Profile | Máy giám thị | Máy chủ | Ghi chú |
|---------|--------------|---------|---------|
| **A — ThinProctor** | 2 GB — chỉ trình duyệt | PC khác ≥ 4 GB RAM | Khuyến nghị |
| **C — SingleNode** | 4–8 GB — vừa server vừa giám thị | Cùng một máy | Sau nâng RAM |

## Quy trình setup (7 bước)

| Bước | Nội dung | Windows | Ubuntu |
|------|----------|---------|--------|
| 1 | Runtime | `setup-windows.bat` (Node, PG, Redis) | `setup-linux.sh` (apt) |
| 2 | Database | `scripts/sql/init-native-db.sql` | Giống |
| 3 | `.env` + IP LAN | `setup-native.ps1` | Trong `setup-linux.sh` |
| 4 | Dependencies | `npm install` | Giống |
| 5 | Build SPA | `npm run build` (production) | Giống |
| 6 | Reverse proxy | nginx portable `tools/nginx/` | nginx system |
| 7 | Schema + giám thị | migration + `seed-proctor-user.mjs` | Giống |

### Setup tự động

**Windows** — double-click hoặc CMD:

```
scripts\setup-windows.bat
scripts\setup-windows.bat --dev
```

**Ubuntu 22.04/24.04:**

```bash
sudo bash scripts/setup-linux.sh
sudo bash scripts/setup-linux.sh --dev
```

| Chế độ | Mô tả |
|--------|--------|
| **production** (mặc định) | Cài đủ, build SPA, nginx, migration, seed, shortcut Desktop |
| **`--dev`** | DB + `.env` + `npm install` — dùng `npm run dev` (Vite) |

Sau setup production, kiểm tra:

```bash
node scripts/edge-bootstrap.mjs
```

### Cài thủ công (khi script tự động thất bại)

1. **Node.js 20 LTS**
2. **PostgreSQL 16** — chạy `psql -U postgres -f scripts/sql/init-native-db.sql`
3. **Redis 7** hoặc `EDGE_LIGHTWEIGHT=true` trong `.env`
4. **nginx** — Windows: portable trong `tools/nginx/`; Linux: site `vvkcbt` từ `scripts/nginx-native.conf`
5. `npm install` → `npm run build` → `npm run migration:run`
6. `powershell -File scripts/setup-native.ps1` (Windows — `.env`, IP, shortcut)

## Development

1. Chạy setup dev: `setup-windows.bat --dev` hoặc `setup-linux.sh --dev`
2. Đảm bảo Postgres mở port **5432** (Redis **6379** hoặc `EDGE_LIGHTWEIGHT=true`)
3. `npm run dev`

Nếu thiếu DB, `dev-prepare.mjs` in hướng dẫn chạy lại setup script.

### Luồng thi local (dev)

1. **Proctor** (`http://localhost:5174`): đăng nhập → import ZIP từ Composer → trên thanh **Lịch mở đề**, bấm **Mở đề** cho môn thi.
2. **Student** (`http://localhost:5173`): đăng nhập bằng **tài khoản 6 số** + PIN 8 số (không phải SBD) → nội quy → **Bắt đầu làm bài**.
3. Dev shortcut: đặt `EDGE_DEV_AUTO_OPEN_SLOTS=true` trong `.env` để API tự mở slot khi thí sinh bắt đầu (chỉ `NODE_ENV=development`).

Gói ZIP mặc định dùng `release_mode: proctor_at_time` — nếu chưa mở đề, API trả `400 Chờ giám thị mở đề`.

## Ngày thi

**Máy chủ:** `scripts\start-edge-server.bat` (hoặc `start-proctor-edge.bat`)

**Máy giám thị 2 GB:** `scripts\start-proctor-client.bat` → nhập IP máy chủ

**Thí sinh:** `scripts\student-kiosk.bat <IP>` hoặc `http://<IP>/student/`

## Xử lý lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| Port 5432 đóng | Khởi động service PostgreSQL; chạy lại setup |
| Redis không có | Cài Memurai (Windows) / `redis-server` (Linux), hoặc `EDGE_LIGHTWEIGHT=true` |
| `psql` không tìm thấy | Thêm PostgreSQL `bin` vào PATH |
| `fe_sendauth: no password supplied` | Nhập mật khẩu `postgres` khi setup hỏi, hoặc đặt `POSTGRES_PASSWORD=` trong `.env` trước khi chạy |
| `password authentication failed` | Mật khẩu `postgres` sai (mật khẩu đặt lúc cài PostgreSQL, không phải mật khẩu app). Setup sẽ hỏi **Y** để sửa `pg_hba.conf` tạm (trust localhost), tạo DB, rồi khôi phục. Hoặc đặt đúng `POSTGRES_PASSWORD` trong `.env` |
| nginx thiếu (Windows) | Script tải tự động; hoặc `download-nginx-portable.ps1` |
| Import ZIP 413 | `client_max_body_size 100M` trong `nginx-native.conf` |
| `npm run dev` fail DB | `npm run setup` hoặc setup script |

## Tune RAM (Profile C, 4 GB)

PostgreSQL `postgresql.conf`:

```
shared_buffers = 128MB
work_mem = 4MB
```

`.env`:

```env
EDGE_LIGHTWEIGHT=true
```

## Giới hạn khuyến nghị

- Profile C (4 GB): ≤ 30 máy thi
- Profile A (server 8 GB): ≤ 40 máy thi
