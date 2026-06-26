# VNU Edge × vnu-composer — Compatibility Matrix

## Package versions (pin together)

| Package | Version | Repos |
|---------|---------|-------|
| `@vnu/shared-types` | **1.2.0** | VNU Edge, vnu-composer |
| `@vnu/exam-package-kit` | **1.2.0** | VNU Edge, vnu-composer |
| `EXAM_PACKAGE_FORMAT_VERSION` | `1.2` | manifest.json (accepts `1` import) |

### v1.2 highlights

- **credentials.json**: one `examAccount` + PIN per (student × subject)
- **SBD**: 6 chữ số `KKNNNN` — 2 chữ số đầu = khối từ cột Lớp (`10A1`→`10`); 4 số cuối = thứ tự họ tên trong khối (Composer `assignSbdByGrade`)
- **Tài khoản thi** (`examAccount`): 6 chữ số ngẫu nhiên, không trùng
- **PIN**: 8 chữ số ngẫu nhiên
- **Login**: Student uses **Tài khoản thi** (not SBD); SBD remains on slip/display
- **release_mode**: `proctor_at_time` — proctor opens subject slots manually
- **Submit result**: `partScores` (Phần I/II/III); Literature `pendingManual: true`
- **Branding**: `manifest.branding` + `media/branding/logo.png` in ZIP

### Excel import (Composer only)

Sheet `DanhSachThiSinh` with column aliases (see `vnu-composer/apps/web/src/excelImport.ts`):

| Cột Excel | Trường ZIP |
|-----------|------------|
| Họ tên, SBD, Lớp | `fullName`, `sbd`, `className` |
| Ngày sinh, Giới tính | `dateOfBirth`, `gender` |
| Cột môn (đánh dấu X) | `subjects[]` — **đúng một cột X / file** |
| Môn trống (legacy `parseStudentsExcel`) | Mặc định Văn + Toán — **không dùng** trong luồng import môn |

`detectImportSubject()` bắt buộc đúng 1 cột môn có X; `resetComposerForSubject()` giữ roster SBD, xóa papers/credentials môn cũ khi chuyển môn. `kit-sync-check.mjs` kiểm tra marker `detectImportSubject`.

### Ngày sinh / giới tính — chỉ trên phiếu in

- Composer: lưu trong `students.json` + `credentials.json` để **in phiếu 10-up** (`printCredentialSlips.ts`).
- Edge: **không** thêm cột Postgres cho DOB/gender; login và giám sát dùng **tài khoản 6 số** + SBD hiển thị.

### Xuất USB niêm phong — một môn / một ZIP (luồng chính v1.2+)

Composer setup **theo từng môn**: chọn môn → import DS → soạn/ghép đề → SBD & phiếu → **xuất đúng 1 ZIP** (`manifest.exportScope: single_subject`).

- **Mỗi lần xuất USB** sinh **`packageId` mới** (`randomUUID`) — các môn **không** gộp ca trên Edge
- Chỉ **SBD** (6 chữ số) giữ chung giữa các môn khi soạn trên Composer
- Mỗi khung giờ: **một USB** — một môn — import rồi rút USB (niêm phong vật lý)
- Edge: mỗi ZIP = **một ca thi độc lập**; import môn mới **xóa ca cũ** trên máy (nên xuất gói phòng thi trước nếu cần lưu kết quả)
- Tên file: `exam-{packageId8}-{SUBJECT}-{YYYYMMDD}-{HHmm}.zip` (ví dụ `exam-a1b2c3d4-MATH-20260626-0730.zip`)
- Xuất full / bulk nhiều môn: chỉ trong **Nâng cao** Composer (không dùng ngày thi)

Proctor: `GET /api/proctor/packages/status` — `needsImportConfirm` khi đã có ca; `GET /api/proctor/sessions/:id/room-archive` — gói ZIP lưu kết quả (tùy chọn).

After changing `kit.ts`, `exam-package.ts`, or `blueprint-validator.ts`, bump both repos to the same semver and run:

```bash
node scripts/kit-sync-check.mjs
```

## Workflow ngày G

1. **Composer:** Cấu hình ca → **lặp từng môn:** chọn môn → lịch → DS → đề → SBD/phiếu → **Xuất USB** (packageId mới mỗi ZIP) → niêm phong.
2. **USB:** Mỗi USB một file ZIP một môn; ghi nhãn môn + giờ mở đề.
3. **Proctor:** Đúng khung giờ — dry-run → import USB môn đó → thi + giám sát → (tùy chọn) xuất gói phòng thi → import USB môn tiếp theo.
4. **Student:** Tài khoản môn + mật khẩu → chờ/mở đề → làm bài → kết quả theo phần.

## 11 môn TN THPT QĐ764

All subjects validated by `validateSubjectBlueprint` in `@vnu/shared-types`.

## Offline LAN — fonts

Place WOFF2 files under `public/fonts/`:

- `apps/web/student/public/fonts/`
- `apps/web/proctor/public/fonts/`
- `vnu-composer/apps/web/public/fonts/`

Expected names: `BeVietnamPro-Regular.woff2`, `BeVietnamPro-SemiBold.woff2`, `BeVietnamPro-Bold.woff2`

CSS loads local `/fonts/` first; system UI fallback if files are missing.

## Docker

- nginx `client_max_body_size`: **100M** (matches kit `MAX_ZIP_BYTES`)
- `Dockerfile.api` builds `exam-package-kit`
- HA: `docker/postgres/primary.conf` + `docker/nginx/ha.conf` (100M upload)

Build SPAs before HA compose: `npm run build` then mount `student/dist` and `proctor/dist` per `docker-compose.yml`.

## Tests

```bash
# Edge
npm run test -w @vnu/shared-types
npm test -w @vnu/api

# Composer
cd ../vnu-composer && npm run test && npm run build

# Kit sync (both repos checked out as siblings)
node scripts/kit-sync-check.mjs
```

### Exam UI sync (Student × Composer preview)

Sau khi sửa giao diện làm bài, đồng bộ các file sau từ VNU Edge → `vnu-composer/packages/web-shared/` và `packages/shared-types/`:

- `question-order.ts`, `tn-thpt-catalog.ts`, `exam-structure.ts`
- `exam-clusters.ts`, `ExamViewShell.tsx`, `ExamQuestionPalette.tsx`, `QuestionRenderer.tsx`
- `exam-view.css`, `exam-theme.css`, `index.ts` (web-shared)

`kit-sync-check.mjs` kiểm tra hash khớp. Trước release, smoke preview **12 môn** TN_THPT trên Composer (`ExamPreviewPanel`) và ít nhất MATH + ENGLISH + LITERATURE trên Student.
