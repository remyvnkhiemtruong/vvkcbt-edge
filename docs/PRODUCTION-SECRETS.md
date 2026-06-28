# VVKCBT — Production secrets checklist

Dùng trước ngày thi thật (`NODE_ENV=production`).

## Bắt buộc

- [ ] `JWT_SECRET` — ≥32 ký tự, không dùng `change-me-in-production`
- [ ] `ANONYMIZATION_SALT` — chuỗi ngẫu nhiên riêng
- [ ] `AUDIO_ENCRYPTION_KEY` — đúng 32 byte hex
- [ ] `ADMIN_PASSWORD_HASH` — bcrypt (`node scripts/hash-password.mjs <pass>`)
- [ ] `PROCTOR_PASSWORD_HASH` — bcrypt (`node scripts/hash-password.mjs <pass>`)
- [ ] `COMPOSER_PASSWORD_HASH` — bcrypt (máy soạn gói; Edge production không cần composer login nếu không dùng)
- [ ] `ALLOW_DEFAULT_PROCTOR` — **không set** hoặc `false` (bắt buộc; `true` chỉ dev)
- [ ] Giám thị: set `PROCTOR_PASSWORD_HASH` + tạo user qua `scripts/seed-proctor-user.mjs` (không dùng bypass mặc định)
- [ ] `EDGE_ORIGINS` — chỉ IP/host LAN thực tế (không `*`)

## Khuyến nghị

- [ ] `BACKUP_PASSPHRASE` — mã hóa backup at rest
- [ ] Đổi mật khẩu Postgres trong `DATABASE_URL` (user `vnu`)
- [ ] Tắt port 3000 ra ngoài LAN (chỉ nginx :80)
- [ ] Helmet + CORS đã bật trên API (`main.ts`)
- [ ] WebSocket CORS dùng `EDGE_ORIGINS` (`proctoring.gateway.ts`)

## Không làm trên máy thi

- Không chạy `npm run seed` (PIN demo 123456)
- Không commit file `.env` có secret thật
- Không để `COMPOSER_PASSWORD=composer123` trên máy Edge production

## Rate limit

- Đăng nhập thí sinh: 5 lần / 60 giây / tài khoản
- Đăng nhập staff: qua `RateLimitService` trong `staff-auth.service.ts`

## Kiểm tra nhanh

```bash
npm run build && npm run test
node scripts/edge-bootstrap.mjs
```
