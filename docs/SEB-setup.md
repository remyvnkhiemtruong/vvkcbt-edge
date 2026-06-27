# VVKCBT — Safe Exam Browser (tùy chọn)

> **Tại VVK:** thí sinh dùng Chrome/Edge kiosk — xem `docs/BROWSER-KIOSK.md`. SEB không bắt buộc.

**Tác giả:** Trương Minh Khiêm · **Đơn vị:** THPT Võ Văn Kiệt

## Yêu cầu

- Windows 10/11 trên máy thí sinh
- [Safe Exam Browser](https://safeexambrowser.org/download_en.html) (SEB) 3.x
- Máy Edge (giám thị) chạy native stack — `scripts\start-edge-server.bat` — xem `OFFLINE-LAN.md`

## Cấu hình nhanh

1. Trên máy giám thị, ghi nhận **IP LAN** (ví dụ `192.168.1.50`).
2. Mở **SEB Configuration Tool** trên máy mẫu.
3. **Start URL:** `http://<IP_LAN>/student/`  
   Ví dụ: `http://192.168.1.50/student/`
4. **URL filter:** chỉ cho phép IP máy Edge (và `localhost` nếu test).
5. **Quit password:** đặt mật khẩu thoát SEB — giám thị giữ bí mật.
6. Tắt clipboard, screen capture, task switching theo quy chế trường.
7. **File → Export settings** → lưu `VVKCBT-Student.seb`.
8. Copy file `.seb` sang USB và cài SEB trên từng máy thí sinh.

Mẫu plist tham khảo: `scripts/seb/VVKCBT-Student.plist` (mở bằng SEB Config Tool, sửa IP rồi export `.seb`).

## Phát cho thí sinh

| Cách | Ghi chú |
|------|---------|
| Double-click `.seb` | SEB mở và vào thẳng CBT |
| Shortcut Desktop | Trỏ tới `VVKCBT-Student.seb` |

Thí sinh **không** cần internet — chỉ LAN tới máy Edge.

## Kiểm tra trên máy mẫu

1. Mở SEB → vào trang đăng nhập **CBT**.
2. Trang **Nội quy** hiển thị: `Đang chạy trong Safe Exam Browser — OK`.
3. Hệ thống **không** bật fullscreen trùng (SEB đã khóa màn hình).
4. Đăng nhập tài khoản thi + PIN từ phiếu → làm thử → nộp.

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Không vào được trang | Ping IP máy Edge; kiểm tra firewall Windows trên máy giám thị |
| Báo không có SEB | Mở lại bằng file `.seb`, không dùng Chrome/Edge thường |
| Màn hình quá nhỏ | Độ phân giải tối thiểu 1024×768 |
| Thoát SEB | Cần quit password của giám thị |

## Liên quan

- Khởi động giám thị: `scripts/start-proctor-edge.bat`
- Checklist ngày G: `docs/RUNBOOK-NGAY-G.md`
