import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBank } from '../database/entities/question-bank.entity';
import { ExamPaper } from '../database/entities/exam-paper.entity';
import { ExamSession } from '../database/entities/exam-session.entity';
import { MediaAsset } from '../database/entities/media-asset.entity';
import { ExamStructureTemplate } from '../database/entities/exam-structure-template.entity';
import { QuestionCluster } from '../database/entities/question-cluster.entity';
import { TnptComboCatalog } from '../database/entities/tnpt-combo-catalog.entity';
import { FisherYatesService } from './exam-generation/fisher-yates.service';
import { SessionSchedulerService } from './scheduling/session-scheduler.service';
import { StructureResolverService } from './structure/structure-resolver.service';
import { StudentImportService } from './students/student-import.service';
import { ExamMasterService } from './exam-master/exam-master.service';
import { QuestionType, Difficulty, ExamType, ExamRules, StructureSource, ExamStructureTemplate as CatalogStructureTemplate, CognitiveDistribution } from '@vnu/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

@Injectable()
export class CoreService {
  private uploadDir = process.env.UPLOAD_DIR || './uploads';

  constructor(
    @InjectRepository(QuestionBank)
    private readonly questionRepo: Repository<QuestionBank>,
    @InjectRepository(ExamPaper)
    private readonly paperRepo: Repository<ExamPaper>,
    @InjectRepository(ExamSession)
    private readonly sessionRepo: Repository<ExamSession>,
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    @InjectRepository(ExamStructureTemplate)
    private readonly templateRepo: Repository<ExamStructureTemplate>,
    @InjectRepository(QuestionCluster)
    private readonly clusterRepo: Repository<QuestionCluster>,
    @InjectRepository(TnptComboCatalog)
    private readonly comboRepo: Repository<TnptComboCatalog>,
    private readonly fisherYates: FisherYatesService,
    private readonly scheduler: SessionSchedulerService,
    private readonly structureResolver: StructureResolverService,
    private readonly studentImport: StudentImportService,
    private readonly examMaster: ExamMasterService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createQuestion(data: {
    subject: string;
    type: QuestionType;
    difficulty: Difficulty;
    content: Record<string, unknown>;
    correctKey: unknown;
    maxScore?: number;
    uiMode?: string;
    clusterId?: string;
    clusterOrder?: number;
  }) {
    const q = this.questionRepo.create(data);
    return this.questionRepo.save(q);
  }

  async listQuestions(subject?: string) {
    const where = subject ? { subject } : {};
    return this.questionRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getQuestion(id: string) {
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async updateQuestion(id: string, data: Record<string, unknown>) {
    await this.questionRepo.update(id, data as never);
    return this.getQuestion(id);
  }

  async deleteQuestion(id: string) {
    await this.questionRepo.delete(id);
    return { deleted: true };
  }

  async listStructureTemplates(subject?: string) {
    const where: { source: StructureSource; subject?: string } = { source: StructureSource.CUSTOM };
    if (subject) where.subject = subject;
    return this.templateRepo.find({ where, order: { subject: 'ASC' } });
  }

  listSubjects() {
    return this.structureResolver.listSubjects();
  }

  async getSubjectStructure(subjectCode: string, mode: 'default' | 'custom' = 'default') {
    if (mode === 'default') {
      return this.structureResolver.getDefaultForSubject(subjectCode);
    }
    const customs = await this.templateRepo.find({
      where: { subject: subjectCode, source: StructureSource.CUSTOM },
      order: { createdAt: 'DESC' },
    });
    return { customs, default: this.structureResolver.getDefaultForSubject(subjectCode) };
  }

  async getStructureTemplate(id: string) {
    const tpl = await this.templateRepo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async cloneCustomTemplate(sourceId: string, code: string, overrides?: Record<string, unknown>) {
    let sourceEntity: ExamStructureTemplate | null = null;
    try {
      sourceEntity = await this.templateRepo.findOne({ where: { id: sourceId } });
    } catch {
      /* not a UUID — treat as subject code */
    }
    const source =
      sourceEntity ??
      (() => {
        const fromCatalog = this.structureResolver.getDefaultForSubject(sourceId);
        return {
          subject: fromCatalog.subject,
          durationMin: fromCatalog.durationMin,
          totalScore: fromCatalog.totalScore,
          parts: fromCatalog.parts,
          clusterLayout: fromCatalog.clusterLayout ?? null,
          cognitiveDistribution: fromCatalog.cognitiveDistribution ?? null,
          uiMode: fromCatalog.uiMode,
        } as ExamStructureTemplate;
      })();

    const parts = { ...source.parts, ...(overrides?.parts as object) };
    const tpl = this.templateRepo.create({
      code,
      subject: source.subject,
      source: StructureSource.CUSTOM,
      isCustom: true,
      durationMin: (overrides?.durationMin as number) ?? source.durationMin,
      totalScore: source.totalScore,
      parts,
      clusterLayout: source.clusterLayout,
      cognitiveDistribution: source.cognitiveDistribution,
      uiMode: source.uiMode,
      parentTemplateId: sourceEntity?.id,
    });
    return this.templateRepo.save(tpl);
  }

  async listCombos() {
    return this.comboRepo.find({ order: { comboCode: 'ASC' } });
  }

  async createExamSession(data: Partial<ExamSession>) {
    const session = this.sessionRepo.create({
      ...data,
      rules: data.rules ?? this.defaultRules(),
    });
    return this.sessionRepo.save(session);
  }

  async listExamSessions() {
    return this.sessionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateExamSession(id: string, data: Partial<ExamSession>) {
    await this.sessionRepo.update(id, data as never);
    return this.sessionRepo.findOne({ where: { id } });
  }

  private defaultRules(): ExamRules {
    return {
      exam_type: ExamType.TN_THPT_2025,
      structure: { source: 'QD764', is_custom: false },
      cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
      subjects: [
        { code: 'MATH', weight: 3, structureMode: 'default', ui_mode: 'vertical_focus' },
      ],
      scoring: {
        true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
        short_answer_normalize: ['comma_to_dot', 'trim_whitespace'],
      },
      proctoring: { max_focus_violations: 3, autosave_interval_sec: 3 },
      audio: { max_plays: 2, seek_disabled: true },
    };
  }

  async generatePaper(params: {
    examSessionId: string;
    subject: string;
    comboCode?: string;
    structureTemplateId?: string;
    questionCount?: number;
    ratios?: { nb: number; th: number; vd: number; vdc: number };
  }) {
    const examSession = await this.sessionRepo.findOne({ where: { id: params.examSessionId } });
    let template: ExamStructureTemplate | CatalogStructureTemplate | null = null;
    if (params.structureTemplateId) {
      template = await this.structureResolver.resolveByTemplateId(params.structureTemplateId);
    }
    if (!template) {
      template = await this.structureResolver.resolveForSubject(params.subject, examSession?.rules);
    }

    const questions = await this.questionRepo.find({ where: { subject: params.subject } });
    if (!questions.length) throw new BadRequestException('No questions in bank for subject');

    const clusters = await this.clusterRepo.find({ where: { subject: params.subject } });

    let cognitiveOverride: CognitiveDistribution | undefined;
    if (params.ratios) {
      const total = params.ratios.nb + params.ratios.th + params.ratios.vd + params.ratios.vdc;
      if (total > 0) {
        cognitiveOverride = {
          nhan_biet: params.ratios.nb / total,
          thong_hieu: params.ratios.th / total,
          van_dung: (params.ratios.vd + params.ratios.vdc) / total,
        };
      }
    }

    const templateWithDist = template
      ? {
          ...(template as object),
          cognitiveDistribution:
            cognitiveOverride ??
            (template as { cognitiveDistribution?: CognitiveDistribution }).cognitiveDistribution,
        }
      : null;

    const { selected, difficultyMeta } = templateWithDist
      ? this.fisherYates.generateFromTemplate(
          templateWithDist as unknown as ExamStructureTemplate,
          questions,
          clusters,
        )
      : this.fisherYates.generatePaper(questions, params.questionCount ?? Math.min(40, questions.length));

    const paperQuestions = selected.map((q) => ({
      id: q.id,
      bankQuestionId: q.id,
      type: q.type,
      content: q.content,
      correctKey: q.correctKey,
      maxScore: Number(q.maxScore),
      uiMode: q.uiMode,
      partKey: q.partKey,
      clusterId: q.clusterId,
      passage: q.passage,
    }));

    const paper = this.paperRepo.create({
      title: `${params.subject} - ${template?.code ?? 'Generated'}`,
      subject: params.subject,
      comboCode: params.comboCode,
      examSessionId: params.examSessionId,
      questions: paperQuestions,
      difficultyMeta,
    });

    return this.paperRepo.save(paper);
  }

  async listPapers(examSessionId?: string) {
    const where = examSessionId ? { examSessionId } : {};
    return this.paperRepo.find({ where });
  }

  async saveMedia(file: Express.Multer.File) {
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    const asset = this.mediaRepo.create({
      filename: file.originalname,
      path: filepath,
      mimeType: file.mimetype,
      checksum,
      encrypted: false,
    });
    return this.mediaRepo.save(asset);
  }

  async scheduleStudents(examSessionId: string, studentIds?: string[]) {
    return this.scheduler.scheduleSession(examSessionId, studentIds);
  }

  async exportSchedulePdf(examSessionId: string) {
    return this.scheduler.exportSchedulePdf(examSessionId);
  }

  listCredentials(examSessionId: string) {
    return this.scheduler.listCredentials(examSessionId);
  }

  regenerateCredentials(examSessionId: string, confirm?: boolean) {
    return this.scheduler.regenerateCredentials(examSessionId, confirm);
  }

  async buildCredentialPrint(
    examSessionId: string,
    layout: 'slip' | 'table',
    rows?: Array<{ sbd: string; pin?: string; fullName?: string; comboCode?: string; labRoom?: string }>,
  ) {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Exam session not found');
    if (!rows?.length) {
      throw new BadRequestException('Cần danh sách có PIN — gọi regenerate trước hoặc truyền rows');
    }
    const html = this.scheduler.buildCredentialPrintHtml(session.name, rows, layout);
    return { html, count: rows.length };
  }

  buildStudentTemplate() {
    return this.studentImport.buildTemplateBuffer();
  }

  listStudents(className?: string, comboCode?: string) {
    return this.studentImport.listStudents(className, comboCode);
  }

  importStudents(buffer: Buffer) {
    return this.studentImport.importFromBuffer(buffer);
  }

  deleteStudent(id: string) {
    return this.studentImport.deleteStudent(id);
  }

  buildMasterTemplate(examSessionId: string) {
    return this.examMaster.buildTemplateBuffer(examSessionId);
  }

  importMaster(examSessionId: string, buffer: Buffer) {
    return this.examMaster.importFromBuffer(examSessionId, buffer);
  }

  exportMaster(examSessionId: string) {
    return this.examMaster.exportMaster(examSessionId);
  }
}
