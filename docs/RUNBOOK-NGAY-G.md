# VVKCBT — Runbook ngày G

**THPT Võ Văn Kiệt** · Tác giả hệ thống: **Trương Minh Khiêm**

## T−24 giờ (chuẩn bị)

| Máy Composer (soạn) | Máy Edge (chủ) |
|---------------------|----------------|
| Cấu hình ca (tên kỳ, GK/CK) | `scripts\setup-windows.bat` |
| **Lặp từng môn:** chọn môn → DS → đề → SBD → xuất 1 ZIP/USB | `npm install` + `npm run build` |
| Niêm phong USB + nhãn môn/giờ | Font WOFF2 + logo branding |
| Dry-run Composer trước khi giao USB | `node scripts/edge-bootstrap.mjs` |

- [ ] Máy soạn: **http://localhost:5176** — VVKCBT Composer
- [ ] **Mỗi môn một USB** niêm phong (không gộp nhiều môn vào một USB)
- [ ] Copy USB đúng môn sang máy giám thị trước khung giờ thi môn đó
- [ ] Đặt IP LAN cố định cho máy chủ (ghi vào `EDGE_ORIGINS` trong `.env`)
- [ ] Font WOFF2 trong `apps/web/*/public/fonts/` (3 file Be Vietnam Pro)
- [ ] Logo `LogoVVK.png` → `public/branding/logo.png` (đã có nếu build từ repo)
- [ ] Cấu hình Chrome kiosk trên 1 máy mẫu — xem `docs/BROWSER-KIOSK.md`
- [ ] Chạy `node scripts/edge-bootstrap.mjs` — sửa hết mục ✗

## T−1 giờ (trước giờ thi)

- [ ] Double-click `scripts\start-edge-server.bat` (máy chủ)
- [ ] Máy giám thị 2 GB: `scripts\start-proctor-client.bat` → nhập IP máy chủ
- [ ] Nhập tài khoản giám thị (không dùng mật khẩu mặc định demo)
- [ ] Import ZIP **môn sắp thi** — dry-run → import → xác nhận checklist **Môn đã import** (tab Chuẩn bị)
- [ ] Rút USB sau import; không để USB chứa đề môn khác trên máy giám thị
- [ ] Đăng nhập CBT - Viewer → tab **Lịch môn** — xác nhận giờ mở đề
- [ ] Tab **Giám sát** — grid hiển thị đủ máy
- [ ] 3–5 máy thí sinh: Chrome kiosk → đăng nhập thử → thoát

## Trong giờ thi

- [ ] Thí sinh vào `http://<IP_LAN>/student/` — **tài khoản 6 số** + **PIN 8 số** (không phải SBD)
- [ ] Giám thị theo dõi tab **Giám sát** (cảnh báo vi phạm + âm thanh)
- [ ] Đến khung giờ môn tiếp theo: (tùy chọn) xuất gói phòng tab Báo cáo → cắm USB môn đó → import → mở đề
- [ ] **Không** chạy `npm run seed` trên máy thi
- [ ] Nếu mất điện: giữ máy chủ; Postgres/API tự khởi động lại khi có điện

## Sau ca thi

- [ ] Tab **Báo cáo** → **Xuất gói phòng thi (ZIP)** nếu cần lưu kết quả ca
- [ ] Tab **Sao lưu** → `npm run backup` hoặc backup qua UI
- [ ] Copy file backup ra USB
- [ ] Tab **Báo cáo** / **Nhật ký** nếu cần đối soát

## Liên hệ kỹ thuật nhanh

| Vấn đề | Hành động |
|--------|-----------|
| API không lên | Kiểm tra Postgres port 5432; `npm run start:prod -w @vnu/api` |
| Import lỗi | Dry-run ZIP trên CBT - Viewer; kiểm tra Postgres/nginx |
| Thí sinh không login | Kiểm tra ZIP đã import; đúng tài khoản môn (6 số) + PIN 8 số |
| Mất mạng LAN | Bài đã autosave IndexedDB; chờ mạng để đồng bộ |

## URL tham chiếu

| Ứng dụng | URL |
|----------|-----|
| CBT (thí sinh) | `http://<IP_LAN>/student/` |
| CBT - Viewer | `http://localhost/proctor/` (máy giám thị) |
| Composer | `http://localhost:5176` (máy soạn) |
| API health | `http://localhost:3000/api/infra/health` |
