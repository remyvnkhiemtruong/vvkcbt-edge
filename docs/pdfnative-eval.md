# Đánh giá PDF engine — pdfnative pilot (VVKCBT)

**Tác giả:** Trương Minh Khiêm · THPT Võ Văn Kiệt  
**Ngày:** 2026-06-26

## Hiện trạng

- Biên bản điểm phòng thi: **Puppeteer** (`room-score-sheet.service.ts`)
- Fallback: **Excel** khi Puppeteer lỗi (`X-Pdf-Fallback: excel`)
- Chữ ký giám thị: embed `<img>` data-URL trong HTML → PDF

## Vấn đề Puppeteer trên máy GT yếu

| Metric | Puppeteer (ước lượng) | Mục tiêu pdfnative |
|--------|----------------------|-------------------|
| RAM peak | 200–400 MB | &lt; 80 MB |
| Cold start | 3–8 s | &lt; 1 s |
| Phụ thuộc Chromium | Có | Không |

## Khuyến nghị pilot (Tuần 8+)

1. Giữ **Excel fallback** làm đường dự phòng bắt buộc ngày G.
2. Pilot `pdfnative` hoặc `html2pdfsmith` chỉ cho `buildPdf` biên bản — so sánh A/B trên 1 máy GT 4GB RAM.
3. Tiêu chí chấp nhận: font Times, bảng SBD, chữ ký GT đọc được, in A4 ngang.
4. Không thay thế Puppeteer cho bài làm thí sinh (`post-exam/pdf`) trong pilot đầu.

## Quyết định

- **Ngắn hạn (đã triển khai):** try/catch PDF → Excel + header `X-Pdf-Fallback`
- **Dài hạn:** đánh giá pdfnative sau 1 kỳ thi thử; nếu pass → feature flag `PDF_ENGINE=pdfnative`
