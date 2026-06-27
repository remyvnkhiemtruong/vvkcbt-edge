import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  EXAM_PACKAGE_FORMAT_VERSION,
  ExamType,
  TN_THPT_SUBJECTS,
  DEFAULT_SCHOOL_NAME,
  DEFAULT_SCHOOL_CODE,
  StudentSessionStatus,
  ExamPackageExportState,
  ExamPackageImportResult,
  ExamPackageSessionConfig,
  ExamPackageSubjectRow,
  ExamPackageStudentRow,
  ExamPackagePaperRow,
  ExamPackageClusterRow,
  ExamPackageCredentialRow,
} from '@vnu/shared-types';
import {
  validateZip as kitValidateZip,
  dryRunZip,
  validateExportState as kitValidateExportState,
  extractZipSafe,
  MAX_ZIP_BYTES,
} from '@vnu/exam-package-kit';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { ExamPaper } from '../../database/entities/exam-paper.entity';
import { QuestionBank } from '../../database/entities/question-bank.entity';
import { QuestionCluster } from '../../database/entities/question-cluster.entity';
import { MediaAsset } from '../../database/entities/media-asset.entity';
import { Student } from '../../database/entities/student.entity';
import { Class } from '../../database/entities/class.entity';
import { School } from '../../database/entities/school.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { AnonymizationMap } from '../../database/entities/anonymization-map.entity';
import { ProctorAction } from '../../database/entities/proctor-action.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { GdptSubjectStream } from '../../database/entities/gdpt-subject-stream.entity';
import { AppealRequest } from '../../database/entities/appeal-request.entity';
import { GradingFlag } from '../../database/entities/grading-flag.entity';
import type { ExamPackageManifest } from '@vnu/shared-types';
import { ExamMasterService } from '../exam-master/exam-master.service';

const REQUIRED_FILES = ['manifest.json', 'session.json', 'subjects.json'];

@Injectable()
export class ExamPackageService {
  private uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

  constructor(
    @InjectRepository(ExamSession)
    private readonly sessionRepo: Repository<ExamSession>,
    @InjectRepository(ExamPaper)
    private readonly paperRepo: Repository<ExamPaper>,
    @InjectRepository(QuestionBank)
    private readonly questionRepo: Repository<QuestionBank>,
    @InjectRepository(QuestionCluster)
    private readonly clusterRepo: Repository<QuestionCluster>,
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    private readonly examMaster: ExamMasterService,
    private readonly dataSource: DataSource,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async buildTemplateZip(): Promise<Buffer> {
    const { buildTemplateZip } = await import('@vnu/exam-package-kit');
    return buildTemplateZip();
  }

  async exportFromState(state: ExamPackageExportState): Promise<Buffer> {
    const { exportFromState } = await import('@vnu/exam-package-kit');
    return exportFromState(state);
  }

  validateExportState(state: ExamPackageExportState) {
    return kitValidateExportState(state);
  }

  async dryRun(buffer: Buffer) {
    const result = await dryRunZip(buffer);
    const labRoomCheck = await this.checkLabRoomCoverage(buffer);
    result.checklist.push(labRoomCheck);
    if (!labRoomCheck.ok) {
      result.passed = false;
    }
    return result;
  }

  /** Cảnh báo nếu >20% HS thiếu labRoom — ảnh hưởng đếm completion phòng. */
  private async checkLabRoomCoverage(buffer: Buffer): Promise<{
    item: string;
    ok: boolean;
    detail?: string;
  }> {
    const workDir = await extractZipSafe(buffer);
    try {
      const studentsPath = path.join(workDir, 'students.json');
      if (!fs.existsSync(studentsPath)) {
        return { item: 'labRoom: students.json', ok: true, detail: 'Không có students.json' };
      }
      const rows = JSON.parse(fs.readFileSync(studentsPath, 'utf8')) as Array<{ labRoom?: string }>;
      if (!rows.length) return { item: 'labRoom', ok: true, detail: '0 thí sinh' };
      const missing = rows.filter((r) => !r.labRoom?.trim()).length;
      const pct = (missing / rows.length) * 100;
      const ok = pct <= 20;
      return {
        item: 'labRoom: phòng máy thí sinh',
        ok,
        detail: ok
          ? `${rows.length - missing}/${rows.length} có phòng`
          : `${missing}/${rows.length} thiếu phòng (${pct.toFixed(0)}%) — cần ≤20%`,
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  async validateZip(buffer: Buffer) {
    return kitValidateZip(buffer);
  }

  async importZip(buffer: Buffer): Promise<ExamPackageImportResult> {
    if (buffer.length > MAX_ZIP_BYTES) {
      throw new BadRequestException('File ZIP vượt quá 100MB');
    }

    const validation = await this.validateZip(buffer);
    if (!validation.valid || !validation.manifest) {
      throw new BadRequestException(validation.errors.join('; ') || 'ZIP không hợp lệ');
    }

    const workDir = await extractZipSafe(buffer);
    const manifest = validation.manifest;

    try {
      const sessionConfig = JSON.parse(
        fs.readFileSync(path.join(workDir, 'session.json'), 'utf8'),
      ) as ExamPackageSessionConfig;
      const subjects = JSON.parse(
        fs.readFileSync(path.join(workDir, 'subjects.json'), 'utf8'),
      ) as ExamPackageSubjectRow[];

      this.validateConcurrentExamImport(workDir, manifest, subjects);
      sessionConfig.rules = this.mergeSubjectsIntoRules(sessionConfig.rules, subjects);
      const isSingleSubject = manifest.exportScope === 'single_subject';
      const importSubjectCode = isSingleSubject
        ? this.resolveImportSubjectCode(manifest, subjects)
        : null;

      const activeSession = await this.sessionRepo.findOne({
        where: { status: 'active' },
        order: { updatedAt: 'DESC' },
      });
      let mergeSessionId: string | null = null;
      if (isSingleSubject && activeSession && subjects[0]) {
        if (await this.canMergeConcurrentSubject(activeSession.id, subjects[0])) {
          mergeSessionId = activeSession.id;
        }
      }

      let studentsCreated = 0;
      let studentsUpdated = 0;
      let slotsCreated = 0;
      let slotsUpdated = 0;
      let slotsRemoved = 0;
      let papersCreated = 0;
      let papersUpdated = 0;
      let mediaImported = 0;
      const errors: ExamPackageImportResult['errors'] = [];
      let examSessionId = '';

      await this.dataSource.transaction(async (manager) => {
        const sessionRepo = manager.getRepository(ExamSession);
        const paperRepo = manager.getRepository(ExamPaper);
        const clusterRepo = manager.getRepository(QuestionCluster);
        const mediaRepo = manager.getRepository(MediaAsset);

        if (!mergeSessionId) {
          const existingSessionCount = await sessionRepo.count();
          if (existingSessionCount > 0) {
            await this.purgeAllEdgeExamData(manager);
          }
        } else {
          examSessionId = mergeSessionId;
          if (importSubjectCode) {
            const hasPaper = await paperRepo.findOne({
              where: { examSessionId, subject: importSubjectCode },
            });
            if (hasPaper) {
              await this.snapshotBeforePurge(examSessionId, importSubjectCode);
              await this.purgeSubjectImportData(manager, examSessionId, importSubjectCode);
            }
          }
          const current = await sessionRepo.findOne({ where: { id: examSessionId } });
          if (current) {
            const mergedRules = this.mergeSubjectsIntoRules(current.rules, subjects);
            await sessionRepo.update(examSessionId, {
              rules: mergedRules as never,
              packageId: manifest.packageId,
            });
          }
        }

        const pathMap = await this.importMediaFromDir(workDir, mediaRepo);
        mediaImported = pathMap.size;

        if (!mergeSessionId) {
          const created = await sessionRepo.save(
            sessionRepo.create({
              name: sessionConfig.name,
              routingMode: 'dynamic_subject' as never,
              status: 'active',
              durationMin: sessionConfig.durationMin ?? 90,
              startAt: sessionConfig.startAt ? new Date(sessionConfig.startAt) : new Date(),
              rules: sessionConfig.rules as never,
              routingConfig: { mode: 'dynamic_subject', resolve_order: ['subject_group'] } as never,
              packageId: manifest.packageId,
            }),
          );
          examSessionId = created.id;
        }

        if (fs.existsSync(path.join(workDir, 'clusters.json'))) {
          const clusters = JSON.parse(
            fs.readFileSync(path.join(workDir, 'clusters.json'), 'utf8'),
          ) as ExamPackageClusterRow[];
          for (const c of clusters) {
            await clusterRepo.save(
              clusterRepo.create({
                subject: c.subject,
                clusterSubtype: c.clusterSubtype,
                passage: this.rewriteMediaPaths(c.passage, pathMap),
                questionIds: c.questionIds,
                difficulty: c.difficulty as never,
              }),
            );
          }
        }

        const papersDir = path.join(workDir, 'papers');
        if (fs.existsSync(papersDir)) {
          for (const file of fs.readdirSync(papersDir).filter((f) => f.endsWith('.json'))) {
            const paperData = JSON.parse(
              fs.readFileSync(path.join(papersDir, file), 'utf8'),
            ) as ExamPackagePaperRow;
            paperData.questions = paperData.questions.map((q) =>
              this.rewriteMediaPaths(q, pathMap),
            ) as Record<string, unknown>[];

            const subject = paperData.subject || path.basename(file, '.json');
            const existingPaper = await paperRepo.findOne({ where: { examSessionId, subject } });
            if (existingPaper) {
              existingPaper.title = paperData.title;
              existingPaper.questions = paperData.questions as never;
              existingPaper.difficultyMeta = paperData.difficultyMeta ?? {};
              await paperRepo.save(existingPaper);
              papersUpdated++;
            } else {
              await paperRepo.save(
                paperRepo.create({
                  title: paperData.title,
                  subject,
                  examSessionId,
                  questions: paperData.questions,
                  difficultyMeta: paperData.difficultyMeta ?? {},
                }),
              );
              papersCreated++;
            }
          }
        }

        const xlsxPath = path.join(workDir, 'kythi-master.xlsx');
        if (fs.existsSync(xlsxPath)) {
          const xlsxBuf = fs.readFileSync(xlsxPath);
          const masterResult = await this.examMaster.importFromBuffer(examSessionId, xlsxBuf);
          if (masterResult.errors.length > 0) {
            throw new BadRequestException(
              masterResult.errors.map((e) => `Excel dòng ${e.row}: ${e.message}`).join('; '),
            );
          }
          studentsCreated += masterResult.students.created;
          studentsUpdated += masterResult.students.updated;
          slotsCreated += masterResult.slots.created;
          slotsUpdated += masterResult.slots.updated;
          slotsRemoved += masterResult.slots.removed;
        } else if (fs.existsSync(path.join(workDir, 'students.json'))) {
          const studentRows = JSON.parse(
            fs.readFileSync(path.join(workDir, 'students.json'), 'utf8'),
          ) as ExamPackageStudentRow[];
          const credPath = path.join(workDir, 'credentials.json');
          const hasCredentials = fs.existsSync(credPath);
          const slotStats = await this.importStudentsJson(
            manager,
            examSessionId,
            studentRows,
            subjects,
            hasCredentials,
            !!mergeSessionId,
          );
          studentsCreated += slotStats.studentsCreated;
          studentsUpdated += slotStats.studentsUpdated;
          slotsCreated += slotStats.slotsCreated;
          slotsUpdated += slotStats.slotsUpdated;
          slotsRemoved += slotStats.slotsRemoved;

          if (hasCredentials) {
            const credentials = JSON.parse(
              fs.readFileSync(credPath, 'utf8'),
            ) as ExamPackageCredentialRow[];
            await this.importCredentialsJson(manager, examSessionId, credentials);
          }
        }

        if (manifest.branding?.logoPath) {
          const logoSrc = path.join(workDir, manifest.branding.logoPath);
          if (fs.existsSync(logoSrc)) {
            const brandingDirs = [
              path.resolve(__dirname, '../../../../web/student/public/branding'),
              path.resolve(__dirname, '../../../../web/proctor/public/branding'),
            ];
            for (const dir of brandingDirs) {
              fs.mkdirSync(dir, { recursive: true });
              fs.copyFileSync(logoSrc, path.join(dir, 'logo.png'));
            }
          }
        }
      });

      const sessionAfter = await this.sessionRepo.findOne({ where: { id: examSessionId } });
      const paperRows = await this.paperRepo.find({ where: { examSessionId } });
      const slotRows = await this.slotRepo.find({ where: { examSessionId } });
      const importedSubjects = [...new Set(paperRows.map((p) => p.subject))];
      const pendingSubjects = subjects
        .map((s) => s.code)
        .filter((code) => !importedSubjects.includes(code));

      return {
        examSessionId,
        packageId: manifest.packageId,
        exportScope: manifest.exportScope,
        subjectCode: importSubjectCode ?? importedSubjects[0],
        importedSubjects,
        pendingSubjects,
        students: { created: studentsCreated, updated: studentsUpdated },
        slots: { created: slotsCreated, updated: slotsUpdated, removed: slotsRemoved },
        papers: { created: papersCreated, updated: papersUpdated },
        media: { imported: mediaImported },
        sessionUpdated: true,
        errors,
      };
    } finally {
      fs.rmSync(path.dirname(workDir), { recursive: true, force: true });
    }
  }

  async getImportStatus(examSessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) {
      throw new BadRequestException('Ca thi không tồn tại');
    }
    const papers = await this.paperRepo.find({ where: { examSessionId } });
    const slots = await this.slotRepo.find({ where: { examSessionId } });
    const ruleSubjects = (session.rules?.subjects ?? []) as Array<{ code: string }>;
    const codes = new Set<string>(ruleSubjects.map((s) => s.code));
    for (const slot of slots) codes.add(slot.subjectCode);

    const subjects = [...codes].map((code) => {
      const meta = TN_THPT_SUBJECTS.find((s) => s.code === code);
      const subjectSlots = slots.filter((s) => s.subjectCode === code);
      const earliest = subjectSlots.reduce<Date | null>((min, s) => {
        const t = s.scheduledStart;
        return !min || t < min ? t : min;
      }, null);
      return {
        code,
        nameVi: meta?.nameVi ?? code,
        scheduledStart: earliest?.toISOString() ?? null,
        hasPaper: papers.some((p) => p.subject === code),
        hasCredentials: subjectSlots.length > 0,
      };
    });

    const importedSubjects = subjects.filter((s) => s.hasPaper).map((s) => s.code);
    const pendingSubjects = subjects.filter((s) => !s.hasPaper).map((s) => s.code);

    return {
      packageId: session.packageId,
      examSessionId,
      importedSubjects,
      pendingSubjects,
      subjects,
    };
  }

  async getPackageStatus(): Promise<{
    examSessionId: string | null;
    sessionName: string | null;
    packageId: string | null;
    roomExportedAt: string | null;
    status: string | null;
    canImportNewPackage: boolean;
    needsImportConfirm: boolean;
  }> {
    const [active] = await this.sessionRepo.find({
      where: { status: 'active' },
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    let latest = active;
    if (!latest) {
      const [row] = await this.sessionRepo.find({ order: { updatedAt: 'DESC' }, take: 1 });
      latest = row;
    }
    if (!latest) {
      return {
        examSessionId: null,
        sessionName: null,
        packageId: null,
        roomExportedAt: null,
        status: null,
        canImportNewPackage: true,
        needsImportConfirm: false,
      };
    }

    return {
      examSessionId: latest.id,
      sessionName: latest.name,
      packageId: latest.packageId,
      roomExportedAt: (() => {
        const raw = latest.roomExportedAt;
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })(),
      status: latest.status,
      canImportNewPackage: true,
      needsImportConfirm: true,
    };
  }

  private async purgeAllEdgeExamData(manager: EntityManager): Promise<void> {
    await manager.getRepository(GradingFlag).createQueryBuilder().delete().execute();
    await manager.getRepository(AppealRequest).createQueryBuilder().delete().execute();
    await manager.getRepository(AnonymizationMap).createQueryBuilder().delete().execute();
    await manager.getRepository(ProctorAction).createQueryBuilder().delete().execute();
    await manager.getRepository(AuditLog).createQueryBuilder().delete().execute();
    await manager.getRepository(StudentSubjectSlot).createQueryBuilder().delete().execute();
    await manager.getRepository(StudentSession).createQueryBuilder().delete().execute();
    await manager.getRepository(GdptSubjectStream).createQueryBuilder().delete().execute();
    await manager.getRepository(ExamPaper).createQueryBuilder().delete().execute();
    await manager.getRepository(ExamSession).createQueryBuilder().delete().execute();
    await manager.getRepository(QuestionBank).createQueryBuilder().delete().execute();
    await manager.getRepository(QuestionCluster).createQueryBuilder().delete().execute();
    await manager.getRepository(MediaAsset).createQueryBuilder().delete().execute();
  }

  private clearUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) return;
    for (const entry of fs.readdirSync(this.uploadDir)) {
      if (entry === '.gitkeep') continue;
      fs.rmSync(path.join(this.uploadDir, entry), { force: true, recursive: true });
    }
  }

  /** Xóa toàn bộ dữ liệu ca thi trên Edge (giữ danh mục trường/lớp/học sinh nếu có). */
  async clearAllExamData(): Promise<{ cleared: true }> {
    await this.dataSource.transaction(async (manager) => {
      await this.purgeAllEdgeExamData(manager);
    });
    this.clearUploadDir();
    return { cleared: true };
  }

  private async importMediaFromDir(
    workDir: string,
    mediaRepo: Repository<MediaAsset>,
  ): Promise<Map<string, string>> {
    const pathMap = new Map<string, string>();
    const mediaRoot = path.join(workDir, 'media');
    if (!fs.existsSync(mediaRoot)) return pathMap;

    const walk = async (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const rel = path.relative(workDir, full).replace(/\\/g, '/');
          const buf = fs.readFileSync(full);
          const checksum = createHash('sha256').update(buf).digest('hex');
          const filename = `${Date.now()}-${path.basename(full)}`;
          const dest = path.join(this.uploadDir, filename);
          fs.writeFileSync(dest, buf);
          const storedPath = `/uploads/${filename}`;
          pathMap.set(rel, storedPath);
          const mediaRel = `media/${path.relative(mediaRoot, full).replace(/\\/g, '/')}`;
          pathMap.set(mediaRel, storedPath);
          const base = path.basename(full);
          pathMap.set(base, storedPath);
          pathMap.set(`media/${base}`, storedPath);
          await mediaRepo.save(
            mediaRepo.create({
              filename,
              path: storedPath,
              mimeType: this.guessMime(full),
              checksum,
              encrypted: false,
            }),
          );
        }
      }
    };
    await walk(mediaRoot);
    return pathMap;
  }

  private rewriteMediaPaths<T>(obj: T, pathMap: Map<string, string>): T {
    if (!obj || pathMap.size === 0) return obj;
    const json = JSON.stringify(obj);
    let out = json;
    pathMap.forEach((newPath, oldPath) => {
      out = out.split(oldPath).join(newPath);
      out = out.split(`[Ảnh: ${oldPath}]`).join(`[Ảnh: ${newPath}]`);
      out = out.split(`[Audio: ${oldPath}]`).join(`[Audio: ${newPath}]`);
    });
    return JSON.parse(out) as T;
  }

  private async importStudentsJson(
    manager: typeof this.dataSource.manager,
    examSessionId: string,
    rows: ExamPackageStudentRow[],
    subjects: ExamPackageSubjectRow[],
    skipSessionCreation = false,
    partialImport = false,
  ) {
    const studentRepo = manager.getRepository(Student);
    const classRepo = manager.getRepository(Class);
    const slotRepo = manager.getRepository(StudentSubjectSlot);
    const sessionRepo = manager.getRepository(StudentSession);
    const school = await this.resolveSchool();

    const scheduleMap = new Map(subjects.map((s) => [s.code, s]));
    const importedSubjectCodes = new Set(subjects.map((s) => s.code));
    let studentsCreated = 0;
    let studentsUpdated = 0;
    let slotsCreated = 0;
    let slotsUpdated = 0;
    let slotsRemoved = 0;

    for (const row of rows) {
      const registered = row.subjects.filter((code) => importedSubjectCodes.has(code));
      if (!registered.length) {
        throw new BadRequestException(
          `HS ${row.studentCode}: không đăng ký môn nào trong gói ca thi`,
        );
      }

      let classId: string | undefined;
      if (row.className) {
        const cls = await this.findOrCreateClass(row.className, school.id, classRepo);
        classId = cls.id;
      }

      let student = await studentRepo.findOne({ where: { studentCode: row.studentCode } });
      if (student) {
        await studentRepo.update(student.id, {
          fullName: row.fullName,
          classId: classId ?? student.classId,
          schoolId: school.id,
          labRoom: row.labRoom?.trim() || student.labRoom,
        });
        studentsUpdated++;
      } else {
        student = await studentRepo.save(
          studentRepo.create({
            fullName: row.fullName,
            studentCode: row.studentCode,
            classId,
            schoolId: school.id,
            labRoom: row.labRoom?.trim() || null,
          }),
        );
        studentsCreated++;
      }

      const existingSlots = await slotRepo.find({ where: { studentId: student.id, examSessionId } });
      const bySubject = new Map(existingSlots.map((s) => [s.subjectCode, s]));

      for (const code of registered) {
        const sched = scheduleMap.get(code);
        if (!sched) continue;
        const start = this.combineDateTime(sched.examDate, sched.startTime);
        const end = this.combineDateTime(sched.examDate, sched.endTime);
        const existing = bySubject.get(code);
        if (existing) {
          if (existing.status !== 'completed') {
            await slotRepo.update(existing.id, { scheduledStart: start, scheduledEnd: end });
            slotsUpdated++;
          }
          bySubject.delete(code);
        } else {
          await slotRepo.save(
            slotRepo.create({
              studentId: student.id,
              examSessionId,
              subjectCode: code,
              scheduledStart: start,
              scheduledEnd: end,
              status: 'scheduled',
            }),
          );
          slotsCreated++;
        }
      }

      for (const [code, orphan] of bySubject) {
        if (partialImport && !importedSubjectCodes.has(code)) continue;
        if (orphan.status !== 'completed') {
          await slotRepo.delete(orphan.id);
          slotsRemoved++;
        }
      }

      if (!skipSessionCreation && row.sbd?.trim() && row.pin?.trim()) {
        const pinHash = await bcrypt.hash(row.pin.trim(), 10);
        const existingSession = await sessionRepo.findOne({
          where: { examSessionId, studentId: student.id },
        });
        if (existingSession) {
          await sessionRepo.update(existingSession.id, {
            sbd: row.sbd.trim(),
            pinHash,
          });
        } else {
          await sessionRepo.save(
            sessionRepo.create({
              sbd: row.sbd.trim(),
              pinHash,
              studentId: student.id,
              examSessionId,
              status: 'NOT_LOGGED_IN' as never,
            }),
          );
        }
      } else if (!skipSessionCreation) {
        throw new BadRequestException(
          `HS ${row.fullName}: thiếu SBD/PIN trong gói — xếp & in phiếu tại Composer trước khi xuất ZIP`,
        );
      }
    }

    return { studentsCreated, studentsUpdated, slotsCreated, slotsUpdated, slotsRemoved };
  }

  private async importCredentialsJson(
    manager: typeof this.dataSource.manager,
    examSessionId: string,
    credentials: ExamPackageCredentialRow[],
  ) {
    const studentRepo = manager.getRepository(Student);
    const sessionRepo = manager.getRepository(StudentSession);
    const paperRepo = manager.getRepository(ExamPaper);

    const byAccount = new Map<string, ExamPackageCredentialRow[]>();
    for (const cred of credentials) {
      if (!cred.examAccount?.trim() || !cred.pin?.trim() || !cred.sbd?.trim()) {
        throw new BadRequestException(`Credential thiếu tài khoản/PIN/SBD: ${cred.fullName}`);
      }
      const account = cred.examAccount.trim();
      const list = byAccount.get(account) ?? [];
      list.push(cred);
      byAccount.set(account, list);
    }

    for (const [account, creds] of byAccount) {
      const primary = creds[0];
      if (!/^\d{6}$/.test(account)) {
        throw new BadRequestException(`Tài khoản phải 6 chữ số: ${account} (${primary.fullName})`);
      }
      const pin = primary.pin.trim();
      if (!/^\d{8}$/.test(pin)) {
        throw new BadRequestException(`PIN phải 8 chữ số: ${primary.fullName}`);
      }
      for (const c of creds) {
        if (c.pin.trim() !== pin) {
          throw new BadRequestException(`PIN không khớp cho tài khoản ${account}`);
        }
        if (c.studentCode !== primary.studentCode) {
          throw new BadRequestException(`Tài khoản ${account} gán cho nhiều mã HS khác nhau`);
        }
      }

      const student = await studentRepo.findOne({ where: { studentCode: primary.studentCode } });
      if (!student) {
        throw new BadRequestException(`Không tìm thấy HS ${primary.studentCode} cho ${account}`);
      }
      if (primary.labRoom?.trim()) {
        await studentRepo.update(student.id, { labRoom: primary.labRoom.trim() });
      }

      const subjectCodes = [...new Set(creds.map((c) => c.subjectCode))];
      let subjectCode: string | undefined;
      let examPaperId: string | undefined;
      if (subjectCodes.length === 1) {
        subjectCode = subjectCodes[0];
        const paper = await paperRepo.findOne({
          where: { examSessionId, subject: subjectCode },
        });
        if (!paper) {
          throw new BadRequestException(`Thiếu đề môn ${subjectCode} cho ${account}`);
        }
        examPaperId = paper.id;
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const existing = await sessionRepo.findOne({ where: { examAccount: account } });
      if (existing && existing.studentId && existing.studentId !== student.id) {
        throw new BadRequestException(`Tài khoản ${account} đã được gán cho thí sinh khác`);
      }
      const payload = {
        sbd: primary.sbd.trim(),
        pinHash,
        studentId: student.id,
        examSessionId,
        subjectCode,
        examPaperId,
        examAccount: account,
      };
      if (existing) {
        await sessionRepo.update(existing.id, payload);
      } else {
        await sessionRepo.save(
          sessionRepo.create({
            ...payload,
            status: StudentSessionStatus.NOT_LOGGED_IN,
            sessionVersion: 1,
          }),
        );
      }
    }
  }

  private mergeSubjectsIntoRules(
    rules: ExamPackageSessionConfig['rules'],
    subjects: ExamPackageSubjectRow[],
  ) {
    const merged = { ...rules, exam_type: ExamType.TN_THPT_2025, subjects: [...(rules.subjects ?? [])] };
    for (const s of subjects) {
      const entry = {
        code: s.code,
        structureMode: s.structureMode,
        ui_mode: s.ui_mode,
        overrides: s.durationMin ? { durationMin: s.durationMin } : undefined,
      };
      const idx = merged.subjects.findIndex((x) => x.code === s.code);
      if (idx >= 0) merged.subjects[idx] = { ...merged.subjects[idx], ...entry };
      else merged.subjects.push(entry);
    }
    return merged;
  }

  private defaultRules() {
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

  private async resolveSchool(): Promise<School> {
    let school = await this.schoolRepo.findOne({ where: {}, order: { createdAt: 'ASC' } });
    if (!school) {
      school = await this.schoolRepo.save(
        this.schoolRepo.create({ name: DEFAULT_SCHOOL_NAME, code: DEFAULT_SCHOOL_CODE }),
      );
    }
    return school;
  }

  private async findOrCreateClass(name: string, schoolId: string, classRepo: Repository<Class>) {
    let cls = await classRepo.findOne({ where: { name, schoolId } });
    if (!cls) {
      const gradeMatch = name.match(/^(\d+)/);
      cls = await classRepo.save(
        classRepo.create({ name, schoolId, grade: gradeMatch?.[1] }),
      );
    }
    return cls;
  }

  private resolveImportSubjectCode(
    manifest: ExamPackageManifest,
    subjects: ExamPackageSubjectRow[],
  ): string {
    const code = manifest.subjectCode ?? subjects[0]?.code;
    if (!code) {
      throw new BadRequestException('Thiếu subjectCode trong manifest hoặc subjects.json');
    }
    return code;
  }

  private subjectTimeKey(s: ExamPackageSubjectRow): string {
    return `${s.examDate}|${s.startTime}|${s.endTime}`;
  }

  private async canMergeConcurrentSubject(
    examSessionId: string,
    newSubject: ExamPackageSubjectRow,
  ): Promise<boolean> {
    const slots = await this.slotRepo.find({ where: { examSessionId }, take: 1 });
    if (slots.length === 0) return true;

    const ref = slots[0];
    const newStart = this.combineDateTime(newSubject.examDate, newSubject.startTime);
    const newEnd = this.combineDateTime(newSubject.examDate, newSubject.endTime);
    return (
      ref.scheduledStart.getTime() === newStart.getTime() &&
      ref.scheduledEnd.getTime() === newEnd.getTime()
    );
  }

  private validateConcurrentExamImport(
    workDir: string,
    manifest: ExamPackageManifest,
    subjects: ExamPackageSubjectRow[],
  ): void {
    if (subjects.length === 0) {
      throw new BadRequestException('subjects.json trống');
    }

    const scope = manifest.exportScope ?? 'full';

    if (scope === 'single_subject') {
      if (subjects.length > 1) {
        throw new BadRequestException('single_subject: subjects.json chỉ được chứa đúng 1 môn');
      }
      const subjectCode = this.resolveImportSubjectCode(manifest, subjects);
      if (subjects[0].code !== subjectCode) {
        throw new BadRequestException(
          `single_subject: subjectCode manifest (${subjectCode}) không khớp subjects.json (${subjects[0].code})`,
        );
      }
    } else {
      const timeKeys = new Set(subjects.map((s) => this.subjectTimeKey(s)));
      if (timeKeys.size > 1) {
        throw new BadRequestException(
          'Gói nhiều môn: tất cả môn phải cùng khung giờ (ngày, giờ bắt đầu, giờ kết thúc)',
        );
      }
    }

    const papersDir = path.join(workDir, 'papers');
    if (fs.existsSync(papersDir)) {
      const paperFiles = fs.readdirSync(papersDir).filter((f) => f.endsWith('.json'));
      const subjectCodes = new Set(subjects.map((s) => s.code));
      for (const file of paperFiles) {
        const code = path.basename(file, '.json');
        if (!subjectCodes.has(code)) {
          throw new BadRequestException(`papers/${file}: không có trong subjects.json`);
        }
      }
    }

    const studentsPath = path.join(workDir, 'students.json');
    if (fs.existsSync(studentsPath)) {
      const students = JSON.parse(
        fs.readFileSync(studentsPath, 'utf8'),
      ) as ExamPackageStudentRow[];
      const allowedSubjects = new Set(subjects.map((s) => s.code));
      for (const row of students) {
        if (!row.subjects?.length) {
          throw new BadRequestException(`HS ${row.studentCode}: chưa đăng ký môn thi`);
        }
        for (const code of row.subjects) {
          if (!allowedSubjects.has(code)) {
            throw new BadRequestException(
              `HS ${row.studentCode}: môn ${code} không có trong subjects.json`,
            );
          }
        }
        if (scope === 'single_subject') {
          const subjectCode = this.resolveImportSubjectCode(manifest, subjects);
          if (row.subjects.length !== 1 || row.subjects[0] !== subjectCode) {
            throw new BadRequestException(
              `HS ${row.studentCode}: single_subject — HS phải đúng một môn ${subjectCode}`,
            );
          }
        }
      }
    }

    const credPath = path.join(workDir, 'credentials.json');
    if (fs.existsSync(credPath)) {
      const credentials = JSON.parse(
        fs.readFileSync(credPath, 'utf8'),
      ) as ExamPackageCredentialRow[];
      const allowed = new Set(subjects.map((s) => s.code));
      for (const cred of credentials) {
        if (!allowed.has(cred.subjectCode)) {
          throw new BadRequestException(
            `Credential ${cred.examAccount}: môn ${cred.subjectCode} không có trong gói`,
          );
        }
      }
    }
  }

  private async snapshotBeforePurge(examSessionId: string, subjectCode: string): Promise<void> {
    const backupDir = process.env.BACKUP_DIR || './backups';
    fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(backupDir, `pre-purge-${examSessionId.slice(0, 8)}-${subjectCode}-${ts}.json`);
    const studentSessionRepo = this.dataSource.getRepository(StudentSession);
    const [slots, sessions, papers] = await Promise.all([
      this.slotRepo.find({ where: { examSessionId, subjectCode } }),
      studentSessionRepo.find({ where: { examSessionId, subjectCode } }),
      this.paperRepo.find({ where: { examSessionId, subject: subjectCode } }),
    ]);
    fs.writeFileSync(
      file,
      JSON.stringify({ examSessionId, subjectCode, exportedAt: new Date().toISOString(), slots, sessions, papers }, null, 2),
    );
  }

  private async purgeSubjectImportData(
    manager: EntityManager,
    examSessionId: string,
    subjectCode: string,
  ): Promise<void> {
    const paperRepo = manager.getRepository(ExamPaper);
    const clusterRepo = manager.getRepository(QuestionCluster);
    const slotRepo = manager.getRepository(StudentSubjectSlot);
    const sessionRepo = manager.getRepository(StudentSession);

    await sessionRepo.delete({ examSessionId, subjectCode });
    await slotRepo
      .createQueryBuilder()
      .delete()
      .where('exam_session_id = :examSessionId', { examSessionId })
      .andWhere('subject_code = :subjectCode', { subjectCode })
      .andWhere('status != :completed', { completed: 'completed' })
      .execute();
    await paperRepo.delete({ examSessionId, subject: subjectCode });
    await clusterRepo.delete({ subject: subjectCode });
  }

  private combineDateTime(dateStr: string, time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(dateStr);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  private guessMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
