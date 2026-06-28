# Changelog — Security fixes

## Tóm tắt TASK 1→10

| TASK | Mô tả | Trạng thái |
|------|--------|------------|
| 1 | WebSocket auth (`proctor_action`, `focus_violation`, `help_request`) | Done |
| 2 | `ALLOW_DEFAULT_PROCTOR`, xóa `ensureDefaultProctorUser`, production secrets | Done |
| 3 | Rate-limit đăng nhập thí sinh (5/60s) | Done |
| 4 | Path traversal backup restore + sanitize upload | Done |
| 5 | Bỏ default `AUDIO_ENCRYPTION_KEY` | Done |
| 6 | Setup scripts sinh secret + preflight production checks | Done |
| 7 | Client IP không tin `X-Forwarded-For` trực tiếp | Done |
| 8 | Audio `playCount` tại cấp token | Done |
| 9 | Zip-bomb guard 500MB sau giải nén | Done |
| 10 | `npm audit fix`, ESLint, mở rộng CI | Done |

**Quyết định đã áp dụng:** Xóa hẳn `ensureDefaultProctorUser()` — proctor chỉ qua `seed-proctor-user.mjs`. `MAX_EXTRACTED_BYTES` = 500MB.

**Ghi chú ESLint:** Rules bật ở mức `warn` cho codebase hiện có (31 warnings); nâng lên `error` dần khi dọn warnings.

**Ghi chú audit:** `npm audit fix` (không `--force`) đã cập nhật 1 package; còn high/critical cần `--force` (breaking) — chưa áp dụng theo yêu cầu.

---

## TASK 1 — WebSocket gateway giám thị (Done)

**Files:** `apps/api/src/edge/proctoring/proctoring.gateway.ts`, `apps/api/src/edge/proctoring/proctoring.gateway.spec.ts`

**Why:** `proctor_action`, `focus_violation`, `help_request` không xác thực JWT — client có thể khóa/nộp bài/gắn cờ gian lận cho session bất kỳ.

**Fix:** Thêm `verifySocketToken` cho cả 3 handler; student dùng `payload.sessionId`; proctor audit dùng `payload.sub`.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern=proctoring.gateway` — 7 tests pass.

## TASK 2 — Bỏ bypass proctor mặc định (Done)

**Files:** `staff-auth.service.ts`, `staff-user.service.ts`, `main.ts`, `validate-production-secrets.ts`, `.env.example`, `docs/PRODUCTION-SECRETS.md`

**Why:** Bypass cứng `proctor/proctor123` luôn hoạt động; DB sync ghi đè password mỗi lần khởi động.

**Fix:** `ALLOW_DEFAULT_PROCTOR` (mặc định false); xóa `ensureDefaultProctorUser`; mở rộng `validateProductionSecrets` cho production.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern="validate-production-secrets|staff-auth"` — pass.

## TASK 3 — Rate-limit đăng nhập thí sinh (Done)

**Files:** `apps/api/src/edge/auth/student-auth.service.ts`, `student-auth.service.spec.ts`

**Fix:** `RateLimitService.check('student:${trimmed}', 5, 60)` đầu hàm `login()`.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern=student-auth` — pass.

## TASK 4 — Path traversal backup restore (Done)

**Files:** `backup.controller.ts`, `backup.service.ts`, `core.service.ts`, `backup.service.spec.ts`

**Fix:** `path.basename` ở controller + defense in depth service; sanitize `originalname` upload.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern=backup` — pass.

## TASK 5 — Bỏ default audio encryption key (Done)

**Files:** `infra.controller.ts`, `.env.example`, `dev-prepare.mjs`, `jest.setup.js`

**Fix:** `resolveAudioEncryptionKey()` throw nếu thiếu/<32 ký tự; dev-prepare tự sinh key.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern=infra.controller` — pass.

## TASK 6 — Setup & preflight (Done)

**Files:** `generate-setup-secrets.mjs`, `env-preflight-checks.mjs`, `setup-native.ps1`, `setup-linux.sh`, `edge-bootstrap.mjs`, `preflight-day-g.mjs`

**Fix:** Tự sinh JWT/SALT/AUDIO key khi tạo `.env`; preflight kiểm tra production env.

**Verify:** `node scripts/edge-bootstrap.mjs` với `.env` dev → NOT READY (exit 1).

## TASK 7 — Client IP (Done)

**Files:** `client-ip.ts`, `nginx-native.conf`, `client-ip.spec.ts`

**Fix:** `getClientIpFromRequest` dùng `req.ip`; nginx ghi `$remote_addr`.

**Verify:** `npm run test -w @vnu/api -- --testPathPattern=client-ip` — pass.

## TASK 8 — Audio playCount race (Done)

**Files:** `infra.controller.ts`, `infra.controller.spec.ts`

**Fix:** Tăng `playCount` tại `createAudioToken`, không tại `streamAudio`.

**Verify:** Test lần 3 token → `Max plays exceeded`.

## TASK 9 — Zip-bomb (Done)

**Files:** `packages/exam-package-kit/src/kit.ts`, `kit-zip-bomb.test.ts`

**Fix:** `MAX_EXTRACTED_BYTES=500MB`, `checkExtractedZipSizeLimit`, cleanup `workDir` on failure.

**Verify:** `npm run test -w @vnu/exam-package-kit` — pass.

## TASK 10 — ESLint, audit, CI (Done)

**Files:** `eslint.config.mjs`, `package.json`, `.github/workflows/ci.yml`, `package-lock.json`, `exam-master.spec.ts` (11 môn)

**Fix:** ESLint flat config; CI thêm `lint`, full API tests, `npm audit --omit=dev --audit-level=high`.

**Verify:** `npm run build`, `npm run test`, `npm run lint` — pass.
