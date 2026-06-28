# VNU Edge × vvkcbt-composer — Compatibility Matrix

## Package versions (pin together)

| Package | Version | Repos |
|---------|---------|-------|
| `@vnu/shared-types` | **1.2.0** | VNU Edge, vvkcbt-composer |
| `@vnu/exam-package-kit` | **1.2.0** | VNU Edge, vvkcbt-composer |
| `EXAM_PACKAGE_FORMAT_VERSION` | `1.2` | manifest.json (accepts `1` import) |

### v1.2 highlights

- **credentials.json**: one `examAccount` + PIN per (student × subject)
- **SBD**: 6 chữ số `KKNNNN` — 2 chữ số đầu = khối từ cột Lớp (`10A1`→`10`); 4 số cuối = thứ tự họ tên trong khối (Composer `assignSbdByGrade`)
- **Tài khoản thi** (`examAccount`): 6 chữ số ngẫu nhiên, không trùng
- **PIN**: 8 chữ số ngẫu nhiên
- **Login**: Student uses **Tài khoản thi** (not SBD); SBD remains on slip/display
- **release_mode**: `proctor_at_time` — proctor opens subject slots manually
- **i18n exam UI**: `vi.exam.answeredCount`, `emptyQuestions`, `renderError` — dùng bởi `ExamPage` (Edge) và `ExamPreviewPanel` (Composer); đồng bộ qua `node scripts/kit-sync-check.mjs`
- **Submit result**: `partScores` (Phần I/II/III)
- **Branding**: `manifest.branding` + `media/branding/logo.png` in ZIP

### Excel import (Composer only)

Sheet `DanhSachThiSinh` with column aliases (see `vvkcbt-composer/apps/web/src/excelImport.ts`):

| Cột Excel | Trường ZIP |
|-----------|------------|
| Họ tên, SBD, Lớp | `fullName`, `sbd`, `className` |
| Ngày sinh, Giới tính | `dateOfBirth`, `gender` |
| Cột môn (đánh dấu X) | `subjects[]` — **đúng một cột X / file** |
| Môn trống (legacy `parseStudentsExcel`) | Mặc định Toán — **không dùng** trong luồng import môn |

`detectImportSubject()` bắt buộc đúng 1 cột môn có X; `resetComposerForSubject()` giữ roster SBD, xóa papers/credentials môn cũ khi chuyển môn. `kit-sync-check.mjs` kiểm tra marker `detectImportSubject`.

### Ngày sinh / giới tính — chỉ trên phiếu in

- Composer: lưu trong `students.json` + `credentials.json` để **in phiếu 10-up** (`printCredentialSlips.ts`).
- Edge: **không** thêm cột Postgres cho DOB/gender; login và giám sát dùng **tài khoản 6 số** + SBD hiển thị.

### Xuất USB — một môn / một ZIP (Composer)

Composer soạn **theo từng môn**: chọn môn → import DS → soạn đề → SBD & phiếu → xuất ZIP (`exportScope: single_subject`).

- **Không dùng tổ hợp môn** — mỗi thí sinh chỉ có đúng **một môn** trong `subjects[]` / `credentials.json`
- **Cùng khung giờ**: import USB môn thứ hai (cùng ngày/giờ) trên Edge **gộp vào một ca**; thí sinh A thi Toán, thí sinh B thi Lý trong cùng giờ
- **Khung giờ khác**: import sẽ **thay ca** (xác nhận trước; nên xuất gói phòng thi nếu cần lưu kết quả)
- Gói `full` (Nâng cao Composer): nhiều môn trong một ZIP — tất cả môn phải **cùng khung giờ**

Proctor: `GET /api/proctor/packages/status` — `needsImportConfirm` khi đã có ca; `GET /api/proctor/sessions/:id/room-archive` — gói ZIP lưu kết quả (tùy chọn).

After changing `kit.ts`, `exam-package.ts`, or `blueprint-validator.ts`, bump both repos to the same semver and run:

```bash
node scripts/kit-sync-check.mjs
```

## Workflow ngày G

1. **Composer:** Cấu hình ca → **lặp từng môn** (không tổ hợp): chọn môn → lịch → DS (1 cột môn X) → đề → SBD/phiếu → Xuất USB.
2. **USB:** Mỗi USB một môn; ghi nhãn môn + giờ mở đề.
3. **Proctor:** Đúng khung giờ — dry-run → import USB từng môn (cùng giờ = gộp ca) → giám sát tất cả môn trong ca → kết thúc từng môn / biên bản.
4. **Student:** Tài khoản môn + PIN → làm bài **một môn** → kết quả.

## 10 môn TN THPT QĐ764

All subjects validated by `validateSubjectBlueprint` in `@vnu/shared-types`.

## Offline LAN — fonts

Place WOFF2 files under `public/fonts/`:

- `apps/web/student/public/fonts/`
- `apps/web/proctor/public/fonts/`
- `vvkcbt-composer/apps/web/public/fonts/`

Expected names: `BeVietnamPro-Regular.woff2`, `BeVietnamPro-SemiBold.woff2`, `BeVietnamPro-Bold.woff2`

CSS loads local `/fonts/` first; system UI fallback if files are missing.

## Native reverse proxy

- nginx `client_max_body_size`: **100M** (khớp kit `MAX_ZIP_BYTES`)
- Windows: `scripts/nginx-native.conf` → `tools/nginx/` qua `run-nginx-portable.ps1`
- Ubuntu: `setup-linux.sh` sinh site nginx từ cùng template
- Build SPA trước ngày thi: `npm run build`

## Tests

```bash
# Edge
npm run test -w @vnu/shared-types
npm test -w @vnu/api

# Composer
cd ../vvkcbt-composer && npm run test && npm run build

# Kit sync (both repos checked out as siblings)
node scripts/kit-sync-check.mjs
```

### Exam UI sync (Student × Composer preview)

Sau khi sửa giao diện làm bài, đồng bộ các file sau từ VNU Edge → `vvkcbt-composer/packages/web-shared/` và `packages/shared-types/`:

- `question-order.ts`, `tn-thpt-catalog.ts`, `exam-structure.ts`, `question-content.ts`, `exam-package.ts`, `blueprint-validator.ts`
- `exam-clusters.ts`, `ExamViewShell.tsx`, `ExamQuestionPalette.tsx`, `QuestionRenderer.tsx`, `ClusterSubtypeRenderer.tsx`, `RichTextContent.tsx`, `RichTextField.tsx`, `TrueFalseRenderer.tsx`, `ShortAnswerRenderer.tsx`, `InformaticsCodeRenderer.tsx`, `DualCodeBlockView.tsx`, `rich-text-parser.ts`
- `exam-view.css`, `exam-theme.css`, `index.ts` (web-shared)

`kit-sync-check.mjs` kiểm tra hash khớp. Trước release, smoke preview **10 môn** TN_THPT trên Composer (`ExamPreviewPanel`) và ít nhất MATH + ENGLISH + INFORMATICS trên Student.

### Rich-text soạn thảo (Composer v1.3+)

Token markup trong `content` JSONB (không HTML thô):

| Token | Hiển thị |
|-------|----------|
| `**text**` | In đậm |
| `*text*` | In nghiêng |
| `__text__` | Gạch chân (Tiếng Anh notice/flyer) |
| `` `code` `` | Mã inline |
| ` ```cpp` / ` ```python` | Khối code (Tin học) |
| `$…$`, `$$…$$` | KaTeX |
| `[Ảnh: path]`, `[Audio: path]` | Media |

Tin học Phần II: `informaticsSlot` 1–6 trên từng câu Đ/S; tùy chọn `content.codeBlocks[]` (Python + C++ song song).

Tiếng Anh: passage cluster dùng `{{1}}`…`{{6}}` hoặc `___` cho fill_notice / fill_flyer / fill_gap.
