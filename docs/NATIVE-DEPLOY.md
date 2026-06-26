# VVKCBT — Triển khai Native (không Docker)

Đường triển khai **chính** cho THPT Võ Văn Kiệt khi máy yếu (2 GB RAM) hoặc không cài Docker Desktop.

## Hai profile phần cứng

| Profile | Máy giám thị | Máy chủ | Ghi chú |
|---------|--------------|---------|---------|
| **A — ThinProctor** | 2 GB — chỉ trình duyệt | PC khác ≥ 4 GB RAM | Khuyến nghị |
| **C — SingleNode** | 4–8 GB — vừa server vừa giám thị | Cùng một máy | Sau nâng RAM |

## Cài đặt một lần (máy chủ)

1. **Node.js 20 LTS**
2. **PostgreSQL 16** — tạo DB `vnu_exam`, user `vnu`
3. **Redis 7** (Memurai hoặc port Windows) — hoặc `EDGE_LIGHTWEIGHT=true` trong `.env`
4. **nginx portable** — giải nén vào `tools/nginx/` ([nginx.org](https://nginx.org/en/download.html))

```bash
npm install
npm run build
powershell -File scripts/setup-native.ps1
```

## Ngày thi

**Máy chủ:** double-click `scripts\start-edge-server.bat`

**Máy giám thị 2 GB:** `scripts\start-proctor-client.bat` → nhập IP máy chủ

**Thí sinh:** Chrome kiosk — `scripts\student-kiosk.bat <IP>` hoặc `http://<IP>/student/`

## Tune RAM (Profile C, 4 GB)

PostgreSQL `postgresql.conf`:

```
shared_buffers = 128MB
work_mem = 4MB
```

`.env` tùy chọn:

```env
EDGE_LIGHTWEIGHT=true
```

Bỏ qua Redis/Bull queue — API vẫn chạy single-node.

## Giới hạn khuyến nghị

- Profile C (4 GB): ≤ 30 máy thi
- Profile A (server 8 GB): ≤ 40 máy thi

## Docker (tùy chọn)

Nếu máy đủ mạnh: `scripts\start-proctor-edge-docker.bat`
