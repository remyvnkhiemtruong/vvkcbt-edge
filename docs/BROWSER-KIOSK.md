# VVKCBT — Thí sinh bằng trình duyệt (không SEB)

Trường dùng **Chrome/Edge** thay Safe Exam Browser.

## URL

```
http://<IP-máy-chủ>/student/
```

## Cách mở nhanh

### Shortcut kiosk (khuyến nghị)

```bat
scripts\student-kiosk.bat 192.168.1.50
```

Hoặc tạo shortcut Chrome:

```
chrome.exe --kiosk --app=http://192.168.1.50/student/
```

### F11 toàn màn hình

Mở URL bình thường → F11. Hệ thống cũng gọi `requestFullscreen()` khi vào làm bài.

## Cấu hình

`.env` / build:

```env
VITE_EXAM_LOCK_MODE=browser
```

Giá trị `seb` nếu sau này dùng lại Safe Exam Browser.

## Bảo vệ khi thi

- Focus guard (rời tab → cảnh báo giám thị)
- Watermark SBD/tài khoản
- Chặn copy/paste (theo quy chế đề)
- Nút **Gọi giám thị** trên màn làm bài

## SEB (tùy chọn)

Xem `docs/SEB-setup.md` — không bắt buộc tại VVK.
