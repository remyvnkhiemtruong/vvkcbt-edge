import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash, randomUUID } from 'crypto';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import extract from 'extract-zip';
import {
  EXAM_PACKAGE_FORMAT_VERSION,
  ExamRules,
  ExamType,
  RoutingMode,
  TN_THPT_SUBJECTS,
  ExamPackageExportState,
  ExamPackageManifest,
  ExamPackageSessionConfig,
  ExamPackageSubjectRow,
  ExamPackageStudentRow,
  ExamPackageValidateResult,
  ExamPackagePaperRow,
  ExamPackageClusterRow,
  ExamPackageCredentialRow,
  validateAllSubjectBlueprints,
  BLUEPRINT_FIXTURES,
  buildValidEnglishClusters,
} from '@vnu/shared-types';

export const MAX_ZIP_BYTES = 100 * 1024 * 1024;
export const MAX_EXTRACTED_BYTES = 500 * 1024 * 1024;
export const REQUIRED_FILES = ['manifest.json', 'session.json', 'subjects.json'];

export function defaultExamRules(): ExamRules {
  return {
    exam_type: ExamType.TN_THPT_2025,
    structure: { source: 'QD764' as const, is_custom: false },
    cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
    subjects: TN_THPT_SUBJECTS.map((s) => ({
      code: s.code,
      structureMode: 'default' as const,
      ui_mode: s.uiMode,
    })),
    scoring: {
      true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
      short_answer_normalize: ['comma_to_dot', 'trim_whitespace'] as ('comma_to_dot' | 'trim_whitespace')[],
    },
    proctoring: {
      max_focus_violations: 3,
      autosave_interval_sec: 3,
      release_mode: 'proctor_at_time',
      grace_before_min: 5,
      grace_after_min: 15,
      require_fullscreen: true,
      block_copy_paste: true,
      block_context_menu: true,
      watermark: true,
      single_active_session: true,
    },
    audio: { max_plays: 2, seek_disabled: true },
  };
}

export function validateExportState(
  state: ExamPackageExportState,
  opts?: { subjectCode?: string },
): ExamPackageValidateResult {
  const subjectCode = opts?.subjectCode ?? state.manifest.subjectCode;
  const isSingle = !!opts?.subjectCode || state.manifest.exportScope === 'single_subject';
  if (isSingle && subjectCode) {
    return validateSingleSubjectExport(state, subjectCode);
  }
  return validateFullExport(state);
}

function validateCredentialRows(
  creds: ExamPackageCredentialRow[],
  errors: string[],
): void {
  const accountOwner = new Map<string, string>();
  const accountPin = new Map<string, string>();
  for (const c of creds) {
    if (!c.examAccount?.trim()) errors.push(`Thiếu tài khoản: ${c.fullName} / ${c.subjectCode}`);
    else if (!/^\d{6}$/.test(c.examAccount.trim())) {
      errors.push(`Tài khoản phải 6 chữ số: ${c.examAccount}`);
    } else {
      const acct = c.examAccount.trim();
      const owner = accountOwner.get(acct);
      if (owner && owner !== c.studentCode) {
        errors.push(`Tài khoản ${acct} trùng giữa thí sinh khác nhau`);
      } else {
        accountOwner.set(acct, c.studentCode);
      }
      const pin = c.pin?.trim();
      const prevPin = accountPin.get(acct);
      if (prevPin && pin && prevPin !== pin) {
        errors.push(`PIN không khớp cho tài khoản ${acct}`);
      } else if (pin) {
        accountPin.set(acct, pin);
      }
    }
    if (!c.pin?.trim()) errors.push(`Thiếu PIN: ${c.fullName} / ${c.subjectCode}`);
    else if (!/^\d{8}$/.test(c.pin.trim())) {
      errors.push(`PIN phải 8 chữ số: ${c.fullName} / ${c.subjectCode}`);
    }
    if (!c.sbd?.trim()) errors.push(`Thiếu SBD: ${c.fullName}`);
  }
}

function validateSingleSubjectExport(
  state: ExamPackageExportState,
  subjectCode: string,
): ExamPackageValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.manifest?.packageId) errors.push('Thiếu manifest.packageId');
  if (!state.session?.name?.trim()) errors.push('Thiếu tên kỳ thi');

  const paper = state.papers?.[subjectCode];
  if (!paper?.questions?.length) {
    errors.push(`Môn ${subjectCode} chưa có đề hoặc thiếu câu hỏi`);
  }

  const students = (state.students ?? []).filter((st) => st.subjects.includes(subjectCode));
  if (!students.length) warnings.push(`Không có thí sinh đăng ký môn ${subjectCode}`);

  const creds = (state.credentials ?? []).filter((c) => c.subjectCode === subjectCode);
  if (creds.length) {
    validateCredentialRows(creds, errors);
  } else {
    for (const st of students) {
      if (!st.sbd?.trim() || !st.pin?.trim()) {
        errors.push(`Thí sinh ${st.fullName}: chưa có SBD/PIN cho môn ${subjectCode}`);
      }
    }
  }

  if (!state.credentialsAssignedAt) errors.push('Chưa xếp SBD & gán PIN trong Composer');
  if (!state.credentialsPrintedAt) {
    errors.push('Chưa in phiếu thí sinh — in phiếu tại Composer trước khi xuất ZIP');
  }

  const blueprint = validateAllSubjectBlueprints(
    state.papers ?? {},
    [subjectCode],
    state.clusters,
    state.manifest?.mediaManifest,
  );
  errors.push(...blueprint.errors);
  warnings.push(...blueprint.warnings);

  return { valid: errors.length === 0, manifest: state.manifest, errors, warnings };
}

function validateFullExport(state: ExamPackageExportState): ExamPackageValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.manifest?.packageId) errors.push('Thiếu manifest.packageId');
  if (!state.session?.name?.trim()) errors.push('Thiếu tên kỳ thi');

  for (const code of ['MATH']) {
    const paper = state.papers?.[code];
    if (!paper?.questions?.length) {
      errors.push(`Môn bắt buộc ${code} chưa có đề hoặc thiếu câu hỏi`);
    }
  }

  const allSubjects = new Set<string>();
  for (const st of state.students ?? []) {
    for (const sub of st.subjects ?? []) allSubjects.add(sub);
  }

  const creds = state.credentials ?? [];
  if (creds.length > 0) {
    validateCredentialRows(creds, errors);
  } else {
    for (const st of state.students ?? []) {
      if (!st.sbd?.trim() || !st.pin?.trim()) {
        errors.push(`Thí sinh ${st.fullName}: chưa có SBD/PIN — xếp & in phiếu tại Composer trước khi xuất`);
      }
    }
  }

  for (const sub of allSubjects) {
    const paper = state.papers?.[sub];
    if (!paper?.questions?.length) {
      errors.push(`Thí sinh đăng ký môn ${sub} nhưng thiếu papers/${sub}.json`);
    }
  }

  if (!state.students?.length) warnings.push('Chưa có danh sách thí sinh');
  if (!state.credentialsAssignedAt) errors.push('Chưa xếp SBD & gán PIN trong Composer');
  if (!state.credentialsPrintedAt) {
    errors.push('Chưa in phiếu thí sinh — in phiếu tại Composer trước khi xuất ZIP');
  }

  const qCount = Object.values(state.papers ?? {}).reduce((n, p) => n + (p.questions?.length ?? 0), 0);
  if (qCount === 0) warnings.push('Ngân hàng câu hỏi trống');

  const subjectsToValidate = new Set<string>(['MATH', ...allSubjects]);
  const blueprint = validateAllSubjectBlueprints(
    state.papers ?? {},
    [...subjectsToValidate],
    state.clusters,
    state.manifest?.mediaManifest,
  );
  errors.push(...blueprint.errors);
  warnings.push(...blueprint.warnings);

  return { valid: errors.length === 0, manifest: state.manifest, errors, warnings };
}

/** Gói một ca — nhiều môn cùng khung giờ, một ZIP, tài khoản theo thí sinh. */
export function sliceStateForSession(
  state: ExamPackageExportState,
  subjectCodes: string[],
): ExamPackageExportState {
  if (!subjectCodes.length) throw new Error('Chưa chọn môn trong ca thi');

  const codes = new Set(subjectCodes);
  const subjects = state.subjects.filter((s) => codes.has(s.code));
  if (subjects.length !== subjectCodes.length) {
    const missing = subjectCodes.filter((c) => !subjects.some((s) => s.code === c));
    throw new Error(`Chưa có lịch: ${missing.join(', ')}`);
  }

  const timeKeys = new Set(subjects.map((s) => `${s.examDate}|${s.startTime}|${s.endTime}`));
  if (timeKeys.size > 1) {
    throw new Error('Các môn trong cùng ca phải cùng khung giờ (ngày, giờ bắt đầu, giờ kết thúc)');
  }

  const papers: Record<string, ExamPackagePaperRow> = {};
  for (const code of subjectCodes) {
    const paper = state.papers[code];
    if (!paper?.questions?.length) throw new Error(`Môn ${code} chưa có đề`);
    papers[code] = paper;
  }

  const students = state.students
    .filter((st) => st.subjects.some((s) => codes.has(s)))
    .map((st) => ({
      ...st,
      subjects: st.subjects.filter((s) => codes.has(s)),
    }));

  const credentials = state.credentials?.filter((c) => codes.has(c.subjectCode));

  return {
    manifest: {
      ...state.manifest,
      exportScope: 'full',
      subjectCode: undefined,
      createdAt: new Date().toISOString(),
    },
    session: {
      ...state.session,
      rules: {
        ...state.session.rules,
        subjects: (state.session.rules.subjects ?? []).filter((s) => codes.has(s.code)),
      },
    },
    subjects,
    students,
    credentials,
    clusters: state.clusters.filter((c) => codes.has(c.subject)),
    papers,
    mediaFiles: state.mediaFiles,
    credentialsAssignedAt: state.credentialsAssignedAt,
    credentialsPrintedAt: state.credentialsPrintedAt,
  };
}

export function validateSessionExport(
  state: ExamPackageExportState,
  subjectCodes: string[],
): ExamPackageValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sliced: ExamPackageExportState;
  try {
    sliced = sliceStateForSession(state, subjectCodes);
  } catch (e) {
    return {
      valid: false,
      errors: [e instanceof Error ? e.message : 'Không tạo được gói ca thi'],
      warnings,
    };
  }

  if (!sliced.manifest?.packageId) errors.push('Thiếu manifest.packageId');
  if (!sliced.session?.name?.trim()) errors.push('Thiếu tên kỳ thi');

  for (const code of subjectCodes) {
    const count = sliced.students.filter((st) => st.subjects.includes(code)).length;
    if (!count) warnings.push(`Không có thí sinh đăng ký môn ${code}`);
  }

  const creds = sliced.credentials ?? [];
  if (creds.length) {
    validateCredentialRows(creds, errors);
  } else {
    for (const st of sliced.students) {
      if (!st.sbd?.trim() || !st.pin?.trim()) {
        errors.push(`Thí sinh ${st.fullName}: chưa có SBD/PIN — xếp & in phiếu tại Composer`);
      }
    }
  }

  if (!sliced.credentialsAssignedAt) errors.push('Chưa xếp SBD & gán PIN trong Composer');
  if (!sliced.credentialsPrintedAt) {
    errors.push('Chưa in phiếu thí sinh — in phiếu tại Composer trước khi xuất ZIP');
  }

  const blueprint = validateAllSubjectBlueprints(
    sliced.papers,
    subjectCodes,
    sliced.clusters,
    sliced.manifest?.mediaManifest,
  );
  errors.push(...blueprint.errors);
  warnings.push(...blueprint.warnings);

  return { valid: errors.length === 0, manifest: sliced.manifest, errors, warnings };
}

export async function exportSessionFromState(
  state: ExamPackageExportState,
  subjectCodes: string[],
): Promise<Buffer> {
  const validation = validateSessionExport(state, subjectCodes);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const sliced = sliceStateForSession(state, subjectCodes);
  return packState(sliced);
}

export function buildSessionZipFilename(
  state: ExamPackageExportState,
  subjectCodes: string[],
): string {
  const row = state.subjects.find((s) => subjectCodes.includes(s.code));
  const pkg = state.manifest.packageId.slice(0, 8);
  const date = row?.examDate?.replace(/-/g, '') ?? 'nodate';
  const time = row?.startTime?.replace(':', '') ?? '0000';
  const subjPart = subjectCodes.length === 1 ? subjectCodes[0] : `${subjectCodes.length}mon`;
  return `exam-${pkg}-${subjPart}-${date}-${time}.zip`;
}

/** Tách state cho xuất một môn — mỗi ZIP có packageId riêng (ca độc lập trên Edge). */
export function sliceStateForSubject(
  state: ExamPackageExportState,
  subjectCode: string,
): ExamPackageExportState {
  const subjectRow = state.subjects.find((s) => s.code === subjectCode);
  if (!subjectRow) throw new Error(`Môn ${subjectCode} chưa bật trong lịch thi`);

  const paper = state.papers[subjectCode];
  if (!paper?.questions?.length) throw new Error(`Môn ${subjectCode} chưa có đề`);

  const students = state.students
    .filter((st) => st.subjects.includes(subjectCode))
    .map((st) => ({ ...st, subjects: [subjectCode] }));

  const credentials = state.credentials?.filter((c) => c.subjectCode === subjectCode);
  const clusters = state.clusters.filter((c) => c.subject === subjectCode);
  const ruleSubjects = (state.session.rules.subjects ?? []).filter((s) => s.code === subjectCode);
  const exportPackageId = randomUUID();

  return {
    manifest: {
      ...state.manifest,
      packageId: exportPackageId,
      exportScope: 'single_subject',
      subjectCode,
      examName: `${state.manifest.examName} — ${subjectRow.nameVi}`,
      createdAt: new Date().toISOString(),
    },
    session: {
      ...state.session,
      rules: {
        ...state.session.rules,
        subjects: ruleSubjects.length ? ruleSubjects : [{ code: subjectCode, structureMode: 'default', ui_mode: subjectRow.ui_mode }],
      },
    },
    subjects: [subjectRow],
    students,
    credentials,
    clusters,
    papers: { [subjectCode]: paper },
    mediaFiles: state.mediaFiles,
    credentialsAssignedAt: state.credentialsAssignedAt,
    credentialsPrintedAt: state.credentialsPrintedAt,
  };
}

export async function exportSubjectFromState(
  state: ExamPackageExportState,
  subjectCode: string,
): Promise<Buffer> {
  const sliced = sliceStateForSubject(state, subjectCode);
  const validation = validateExportState(sliced, { subjectCode });
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return packState(sliced);
}

/** Tên file ZIP một môn — dùng packageId của bản slice xuất */
export function buildSubjectZipFilename(
  sliced: ExamPackageExportState,
  subjectCode: string,
): string {
  const row = sliced.subjects.find((s) => s.code === subjectCode);
  const pkg = sliced.manifest.packageId.slice(0, 8);
  const date = row?.examDate?.replace(/-/g, '') ?? 'nodate';
  const time = row?.startTime?.replace(':', '') ?? '0000';
  return `exam-${pkg}-${subjectCode}-${date}-${time}.zip`;
}

export async function exportAllSubjectsFromState(
  state: ExamPackageExportState,
): Promise<Array<{ subjectCode: string; buffer: Buffer; filename: string }>> {
  const results: Array<{ subjectCode: string; buffer: Buffer; filename: string }> = [];
  for (const sub of state.subjects) {
    if (!state.papers[sub.code]?.questions?.length) continue;
    const hasStudents = state.students.some((st) => st.subjects.includes(sub.code));
    if (!hasStudents) continue;
    try {
      const sliced = sliceStateForSubject(state, sub.code);
      const validation = validateExportState(sliced, { subjectCode: sub.code });
      if (!validation.valid) continue;
      const buffer = await packState(sliced);
      results.push({
        subjectCode: sub.code,
        buffer,
        filename: buildSubjectZipFilename(sliced, sub.code),
      });
    } catch {
      /* skip subjects that fail validation */
    }
  }
  return results;
}

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

export async function packState(state: ExamPackageExportState): Promise<Buffer> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-pkg-'));
  try {
    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(state.manifest, null, 2));
    fs.writeFileSync(path.join(workDir, 'session.json'), JSON.stringify(state.session, null, 2));
    fs.writeFileSync(path.join(workDir, 'subjects.json'), JSON.stringify(state.subjects, null, 2));
    fs.writeFileSync(path.join(workDir, 'students.json'), JSON.stringify(state.students, null, 2));
    if (state.credentials?.length) {
      fs.writeFileSync(path.join(workDir, 'credentials.json'), JSON.stringify(state.credentials, null, 2));
    }
    if (state.credentialsAssignedAt || state.credentialsPrintedAt) {
      fs.writeFileSync(
        path.join(workDir, 'credentials-meta.json'),
        JSON.stringify(
          { assignedAt: state.credentialsAssignedAt, printedAt: state.credentialsPrintedAt },
          null,
          2,
        ),
      );
    }
    fs.writeFileSync(path.join(workDir, 'clusters.json'), JSON.stringify(state.clusters, null, 2));
    fs.writeFileSync(
      path.join(workDir, 'HuongDan.txt'),
      [
        'HƯỚNG DẪN GÓI KỲ THI VNU',
        '1. Soạn gói bằng VNU Composer',
        '2. Tab SBD & in phiếu: xếp SBD/PIN và in phiếu TRƯỚC khi xuất ZIP',
        '3. Giám thị import ZIP tại Proctor — SBD/PIN đã có sẵn trong gói',
        '',
      ].join('\n'),
    );

    const papersDir = path.join(workDir, 'papers');
    fs.mkdirSync(papersDir, { recursive: true });
    for (const [key, paper] of Object.entries(state.papers)) {
      fs.writeFileSync(path.join(papersDir, `${key}.json`), JSON.stringify(paper, null, 2));
    }

    const mediaManifest = [...(state.manifest.mediaManifest ?? [])];
    if (state.mediaFiles?.length) {
      for (const mf of state.mediaFiles) {
        const dest = path.join(workDir, mf.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, Buffer.from(mf.base64, 'base64'));
        if (!mediaManifest.find((m) => m.path === mf.path)) {
          const buf = Buffer.from(mf.base64, 'base64');
          mediaManifest.push({
            path: mf.path,
            checksum: createHash('sha256').update(buf).digest('hex'),
            mimeType: mf.mimeType,
          });
        }
      }
      state.manifest.mediaManifest = mediaManifest;
      fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(state.manifest, null, 2));
    }

    const zipPath = path.join(path.dirname(workDir), `pkg-${Date.now()}.zip`);
    await zipDirectory(workDir, zipPath);
    const buf = fs.readFileSync(zipPath);
    fs.unlinkSync(zipPath);
    return buf;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export function getDirSizeBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSizeBytes(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

export function checkExtractedZipSizeLimit(sizeBytes: number): void {
  if (sizeBytes > MAX_EXTRACTED_BYTES) {
    throw new Error(
      'Gói ZIP sau khi giải nén vượt quá 500MB — có thể là file lỗi hoặc zip-bomb',
    );
  }
}

export async function extractZipSafe(buffer: Buffer): Promise<string> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-import-'));
  const zipPath = path.join(workDir, 'upload.zip');
  fs.writeFileSync(zipPath, buffer);
  const extractDir = path.join(workDir, 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });
  try {
    await extract(zipPath, { dir: extractDir });
    checkExtractedZipSizeLimit(getDirSizeBytes(extractDir));
    return extractDir;
  } catch (err) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw err;
  }
}

export async function validateZip(buffer: Buffer): Promise<ExamPackageValidateResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (buffer.length > MAX_ZIP_BYTES) {
    return { valid: false, errors: ['File ZIP vượt quá 100MB'], warnings };
  }

  const workDir = await extractZipSafe(buffer);
  try {
    for (const file of REQUIRED_FILES) {
      if (!fs.existsSync(path.join(workDir, file))) {
        errors.push(`Thiếu file bắt buộc: ${file}`);
      }
    }

    let manifest: ExamPackageManifest | undefined;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8')) as ExamPackageManifest;
      if (manifest.formatVersion !== EXAM_PACKAGE_FORMAT_VERSION && manifest.formatVersion !== '1') {
        errors.push(`formatVersion không hỗ trợ: ${manifest.formatVersion}`);
      }
      if (!manifest.packageId) errors.push('manifest.packageId thiếu');
    } catch {
      errors.push('manifest.json không hợp lệ');
    }

    if (!fs.existsSync(path.join(workDir, 'papers'))) {
      warnings.push('Thiếu thư mục papers/');
    }

    if (
      !fs.existsSync(path.join(workDir, 'students.json')) &&
      !fs.existsSync(path.join(workDir, 'kythi-master.xlsx'))
    ) {
      warnings.push('Không có students.json hoặc kythi-master.xlsx');
    }

    const isSingleSubject = manifest?.exportScope === 'single_subject';
    const requiredPaperCodes =
      isSingleSubject && manifest?.subjectCode ? [manifest.subjectCode] : ['MATH'];

    for (const code of requiredPaperCodes) {
      const paperPath = path.join(workDir, 'papers', `${code}.json`);
      if (!fs.existsSync(paperPath)) {
        errors.push(
          isSingleSubject
            ? `Thiếu papers/${code}.json (môn trong gói)`
            : `Thiếu papers/${code}.json (môn bắt buộc)`,
        );
      } else {
        try {
          const paper = JSON.parse(fs.readFileSync(paperPath, 'utf8')) as ExamPackagePaperRow;
          if (!paper.questions?.length) errors.push(`papers/${code}.json không có câu hỏi`);
        } catch {
          errors.push(`papers/${code}.json không hợp lệ`);
        }
      }
    }

    let clusters: ExamPackageClusterRow[] = [];
    const clustersPath = path.join(workDir, 'clusters.json');
    if (fs.existsSync(clustersPath)) {
      try {
        clusters = JSON.parse(fs.readFileSync(clustersPath, 'utf8')) as ExamPackageClusterRow[];
      } catch {
        warnings.push('clusters.json không hợp lệ');
      }
    }

    const papersDir = path.join(workDir, 'papers');
    const subjectCodes: string[] = [];
    if (fs.existsSync(papersDir)) {
      for (const f of fs.readdirSync(papersDir).filter((x) => x.endsWith('.json'))) {
        subjectCodes.push(f.replace('.json', ''));
      }
    }
    const papers: Record<string, ExamPackagePaperRow> = {};
    for (const code of subjectCodes) {
      try {
        papers[code] = JSON.parse(
          fs.readFileSync(path.join(papersDir, `${code}.json`), 'utf8'),
        ) as ExamPackagePaperRow;
      } catch {
        errors.push(`papers/${code}.json không hợp lệ`);
      }
    }
    const blueprint = validateAllSubjectBlueprints(
      papers,
      subjectCodes,
      clusters,
      manifest?.mediaManifest,
    );
    errors.push(...blueprint.errors);
    warnings.push(...blueprint.warnings);

    return { valid: errors.length === 0, manifest, errors, warnings };
  } finally {
    const parent = path.dirname(workDir);
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

export async function dryRunZip(buffer: Buffer): Promise<{
  passed: boolean;
  checklist: Array<{ item: string; ok: boolean; detail?: string }>;
}> {
  const validation = await validateZip(buffer);
  const checklist: Array<{ item: string; ok: boolean; detail?: string }> = [
    { item: 'ZIP hợp lệ', ok: validation.valid, detail: validation.errors.join('; ') || undefined },
  ];

  const workDir = await extractZipSafe(buffer);
  try {
    const papersDir = path.join(workDir, 'papers');
    let clusters: ExamPackageClusterRow[] = [];
    const clustersPath = path.join(workDir, 'clusters.json');
    if (fs.existsSync(clustersPath)) {
      try {
        clusters = JSON.parse(fs.readFileSync(clustersPath, 'utf8')) as ExamPackageClusterRow[];
      } catch {
        /* ignore */
      }
    }
    if (fs.existsSync(papersDir)) {
      for (const f of fs.readdirSync(papersDir).filter((x) => x.endsWith('.json'))) {
        const code = f.replace('.json', '');
        const paper = JSON.parse(fs.readFileSync(path.join(papersDir, f), 'utf8')) as ExamPackagePaperRow;
        checklist.push({
          item: `Đề ${f}`,
          ok: (paper.questions?.length ?? 0) > 0,
          detail: `${paper.questions?.length ?? 0} câu`,
        });
        const bp = validateAllSubjectBlueprints({ [code]: paper }, [code], clusters);
        checklist.push({
          item: `Blueprint ${code}`,
          ok: bp.valid,
          detail: bp.errors[0] ?? 'OK',
        });
      }
    }
    const hasStudents =
      fs.existsSync(path.join(workDir, 'students.json')) ||
      fs.existsSync(path.join(workDir, 'kythi-master.xlsx'));
    checklist.push({ item: 'Danh sách thí sinh', ok: hasStudents });

    const studentsPath = path.join(workDir, 'students.json');
    if (fs.existsSync(studentsPath)) {
      const students = JSON.parse(fs.readFileSync(studentsPath, 'utf8')) as ExamPackageStudentRow[];
      const allCred = students.every((s) => s.sbd?.trim() && s.pin?.trim());
      checklist.push({
        item: 'SBD/PIN trong gói',
        ok: allCred,
        detail: allCred ? `${students.length} thí sinh` : 'Thiếu SBD/PIN',
      });

      if (validation.manifest?.exportScope === 'single_subject') {
        const subjectCode = validation.manifest.subjectCode;
        const oneSubjectInManifest = subjectCode != null && subjectCode.length > 0;
        checklist.push({
          item: 'single_subject: manifest.subjectCode',
          ok: oneSubjectInManifest,
          detail: subjectCode ?? 'Thiếu subjectCode',
        });
        const subjectsFile = path.join(workDir, 'subjects.json');
        let subjectsOk = false;
        let subjectsDetail = 'Thiếu subjects.json';
        if (fs.existsSync(subjectsFile)) {
          try {
            const subjRows = JSON.parse(fs.readFileSync(subjectsFile, 'utf8')) as ExamPackageSubjectRow[];
            subjectsOk = subjRows.length === 1 && (!subjectCode || subjRows[0].code === subjectCode);
            subjectsDetail =
              subjRows.length === 1
                ? subjRows[0].code
                : `${subjRows.length} môn (cần đúng 1)`;
          } catch {
            subjectsDetail = 'subjects.json không hợp lệ';
          }
        }
        checklist.push({ item: 'single_subject: 1 môn trong subjects.json', ok: subjectsOk, detail: subjectsDetail });
        const allOneSubject = students.every((s) => s.subjects?.length === 1);
        const allMatchCode =
          !subjectCode || students.every((s) => s.subjects?.[0] === subjectCode);
        checklist.push({
          item: 'single_subject: HS chỉ 1 môn',
          ok: allOneSubject && allMatchCode,
          detail: allOneSubject
            ? allMatchCode
              ? `${students.length} HS`
              : 'Môn HS không khớp subjectCode'
            : 'Có HS nhiều hơn 1 môn',
        });
        const credPath = path.join(workDir, 'credentials.json');
        if (fs.existsSync(credPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credPath, 'utf8')) as ExamPackageCredentialRow[];
            const credOk =
              !subjectCode || creds.every((c) => c.subjectCode === subjectCode);
            checklist.push({
              item: 'single_subject: credentials cùng môn',
              ok: credOk,
              detail: credOk ? `${creds.length} credential` : 'subjectCode lệch',
            });
          } catch {
            checklist.push({ item: 'single_subject: credentials.json', ok: false, detail: 'Không hợp lệ' });
          }
        }
      }
    }
  } finally {
    const parent = path.dirname(workDir);
    fs.rmSync(parent, { recursive: true, force: true });
  }

  return { passed: checklist.every((c) => c.ok), checklist };
}

export async function buildTemplateZip(): Promise<Buffer> {
  const packageId = randomUUID();
  const now = new Date().toISOString();
  const manifest: ExamPackageManifest = {
    formatVersion: EXAM_PACKAGE_FORMAT_VERSION,
    packageId,
    examName: 'Thi thử — THPT Võ Văn Kiệt',
    createdAt: now,
    mediaManifest: [],
  };

  const session: ExamPackageSessionConfig = {
    name: manifest.examName,
    routingMode: RoutingMode.FIXED_COMBO,
    status: 'active',
    durationMin: 90,
    startAt: now,
    rules: defaultExamRules(),
  };

  const subjects: ExamPackageSubjectRow[] = TN_THPT_SUBJECTS.map((s, idx) => ({
    code: s.code,
    nameVi: s.nameVi,
    examDate: new Date().toISOString().slice(0, 10),
    startTime: `${String(7 + idx * 2).padStart(2, '0')}:30`,
    endTime: `${String(9 + idx * 2).padStart(2, '0')}:00`,
    durationMin: s.durationMin,
    structureMode: 'default',
    ui_mode: s.uiMode,
  }));

  const papers: Record<string, ExamPackagePaperRow> = {};
  for (const s of TN_THPT_SUBJECTS) {
    papers[s.code] = { ...BLUEPRINT_FIXTURES[s.code], title: `Đề ${s.nameVi} mẫu` };
  }

  const clusters = buildValidEnglishClusters();

  const students: ExamPackageStudentRow[] = [
    {
      fullName: 'Nguyễn Văn A',
      studentCode: 'HS001',
      className: '12A1',
      subjects: ['MATH', 'PHYSICS', 'CHEMISTRY'],
      sbd: '1001',
      pin: '12345678',
    },
  ];

  return packState({
    manifest,
    session,
    subjects,
    students,
    clusters,
    papers,
    credentialsAssignedAt: now,
    credentialsPrintedAt: now,
  });
}

export async function exportFromState(state: ExamPackageExportState): Promise<Buffer> {
  return packState(state);
}
