import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';
import { School } from './entities/school.entity';
import { Class } from './entities/class.entity';
import { Student } from './entities/student.entity';
import { ExamSession } from './entities/exam-session.entity';
import { ExamPaper } from './entities/exam-paper.entity';
import { QuestionBank } from './entities/question-bank.entity';
import { StudentSession } from './entities/student-session.entity';
import { TnptComboCatalog } from './entities/tnpt-combo-catalog.entity';
import { GdptSubjectStream } from './entities/gdpt-subject-stream.entity';
import { StudentSubjectSlot } from './entities/student-subject-slot.entity';
import { QuestionCluster } from './entities/question-cluster.entity';
import {
  QD764_STRUCTURE_TEMPLATES,
  TNPT_36_COMBOS,
  GDPT_STREAM_SAMPLES,
} from './seed-structure-templates';
import { getDefaultStructure } from '@vnu/shared-types';
import { ExamType, QuestionType, Difficulty, RoutingMode, GdptAssessmentPeriod } from '@vnu/shared-types';

async function seed() {
  await dataSource.initialize();
  console.log('Seeding database...');

  const schoolRepo = dataSource.getRepository(School);
  const classRepo = dataSource.getRepository(Class);
  const studentRepo = dataSource.getRepository(Student);
  const sessionRepo = dataSource.getRepository(ExamSession);
  const paperRepo = dataSource.getRepository(ExamPaper);
  const questionRepo = dataSource.getRepository(QuestionBank);
  const studentSessionRepo = dataSource.getRepository(StudentSession);
  const comboRepo = dataSource.getRepository(TnptComboCatalog);
  const streamRepo = dataSource.getRepository(GdptSubjectStream);
  const slotRepo = dataSource.getRepository(StudentSubjectSlot);
  const clusterRepo = dataSource.getRepository(QuestionCluster);

  console.log(`TN THPT catalog: ${QD764_STRUCTURE_TEMPLATES.length} default structures (code-only, not in DB)`);

  for (const combo of TNPT_36_COMBOS) {
    const existing = await comboRepo.findOne({ where: { comboCode: combo.comboCode } });
    if (!existing) {
      await comboRepo.save(comboRepo.create(combo));
    }
  }
  console.log(`Seeded ${TNPT_36_COMBOS.length} TN THPT combos`);

  let school = await schoolRepo.findOne({ where: {} });
  if (!school) {
    school = await schoolRepo.save(schoolRepo.create({ name: 'THPT Demo VNU', code: 'VNU001' }));
  }

  let cls = await classRepo.findOne({ where: {} });
  if (!cls) {
    cls = await classRepo.save(classRepo.create({ name: '12A1', grade: '12', schoolId: school.id }));
  }

  const studentsData = [
    { fullName: 'Nguyễn Văn A', comboCode: 'A00', subjectGroup: 'MATH' },
    { fullName: 'Trần Thị B', comboCode: 'A00', subjectGroup: 'PHYSICS' },
    { fullName: 'Lê Văn C', comboCode: 'D01', subjectGroup: 'ENGLISH' },
  ];

  const students: Student[] = [];
  for (const s of studentsData) {
    let student = await studentRepo.findOne({ where: { fullName: s.fullName } });
    if (!student) {
      student = await studentRepo.save(
        studentRepo.create({ ...s, schoolId: school.id, classId: cls.id }),
      );
    }
    students.push(student);
  }

  const defaultRules = {
    exam_type: ExamType.TN_THPT_2025,
    structure: { source: 'QD764' as const, is_custom: false },
    cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
    subjects: [
      { code: 'MATH', weight: 3, structureMode: 'default' as const, ui_mode: 'vertical_focus' as const },
      { code: 'LITERATURE', weight: 2, structureMode: 'default' as const, ui_mode: 'split_view' as const },
    ],
    scoring: {
      true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
      short_answer_normalize: ['comma_to_dot', 'trim_whitespace'] as ('comma_to_dot' | 'trim_whitespace')[],
    },
    proctoring: { max_focus_violations: 3, autosave_interval_sec: 3 },
    audio: { max_plays: 2, seek_disabled: true },
  };

  let examSession = await sessionRepo.findOne({ where: { name: 'Thi thử TN THPT 2025' } });
  if (!examSession) {
    examSession = await sessionRepo.save(
      sessionRepo.create({
        name: 'Thi thử TN THPT 2025',
        routingMode: RoutingMode.FIXED_COMBO,
        rules: defaultRules,
        routingConfig: {
          mode: RoutingMode.FIXED_COMBO,
          resolve_order: ['combo_code'],
          combo_map: {},
        },
        durationMin: 90,
        status: 'active',
        startAt: new Date(),
      }),
    );
  }

  let gdptSession = await sessionRepo.findOne({ where: { name: 'Kiểm tra GK2 GDPT 2018' } });
  if (!gdptSession) {
    gdptSession = await sessionRepo.save(
      sessionRepo.create({
        name: 'Kiểm tra GK2 GDPT 2018',
        routingMode: RoutingMode.DYNAMIC_SUBJECT,
        rules: {
          exam_type: ExamType.GDPT_2018,
          assessment_period: 'GK2',
          structure: { source: 'QD764', is_custom: false },
          cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
          scoring: defaultRules.scoring,
          proctoring: defaultRules.proctoring,
        },
        routingConfig: {
          mode: RoutingMode.DYNAMIC_SUBJECT,
          resolve_order: ['subject_group', 'grade_stream'],
          subject_map: {},
        },
        durationMin: 50,
        status: 'active',
        startAt: new Date(),
      }),
    );
  }

  if (!examSession || !gdptSession) throw new Error('Failed to create exam sessions');

  const mathQuestions = [
    {
      subject: 'MATH',
      type: QuestionType.MCQ,
      difficulty: Difficulty.MEDIUM,
      content: { stem: 'Cho hàm số $y = x^2 + 1$. Giá trị nhỏ nhất của hàm số là:', options: ['A. 0', 'B. 1', 'C. 2', 'D. -1'] },
      correctKey: 'B',
      maxScore: 0.25,
    },
    {
      subject: 'MATH',
      type: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.HIGH,
      content: {
        stem: 'Cho tứ giác ABCD có AB // CD. Xét các mệnh đề:',
        statements: ['a) ABCD là hình thang', 'b) AC = BD', 'c) Diện tích ABCD > 0', 'd) AB = CD'],
      },
      correctKey: [true, false, true, false],
      maxScore: 1.0,
    },
    {
      subject: 'MATH',
      type: QuestionType.SHORT_ANSWER,
      difficulty: Difficulty.MEDIUM,
      content: { stem: 'Nghiệm của phương trình $2x - 4 = 0$ là $x = $' },
      correctKey: '2',
      maxScore: 0.5,
    },
  ];

  const litQuestions = [
    {
      subject: 'LITERATURE',
      type: QuestionType.ESSAY,
      difficulty: Difficulty.LOW,
      content: {
        passage: 'Đoạn thơ: "Trăng lên đỉnh núi..." — Nguyễn Duy',
        stem: 'Phân tích hình ảnh trăng trong đoạn thơ.',
        subtype: 'comprehension',
      },
      correctKey: '',
      maxScore: 4.0,
      uiMode: 'split_view',
    },
  ];

  const englishCluster = await clusterRepo.findOne({ where: { clusterSubtype: 'reading_8' } });
  let clusterId = englishCluster?.id;
  if (!clusterId) {
    const cluster = await clusterRepo.save(
      clusterRepo.create({
        clusterSubtype: 'reading_8',
        passage: { title: 'City Life', body: 'Many people enjoy living in cities...' },
        questionIds: [],
      }),
    );
    clusterId = cluster.id;
  }

  const englishQuestions = [
    {
      subject: 'ENGLISH',
      type: QuestionType.CLUSTER_MCQ,
      difficulty: Difficulty.MEDIUM,
      content: { stem: 'What is the main idea of the passage?', options: ['A. Rural life', 'B. City benefits', 'C. Travel', 'D. Food'] },
      correctKey: 'B',
      maxScore: 0.25,
      clusterId,
      clusterOrder: 1,
      uiMode: 'split_view',
    },
  ];

  const allQuestions = [...mathQuestions, ...litQuestions, ...englishQuestions];
  const savedQuestions: QuestionBank[] = [];
  for (const q of allQuestions) {
    let existing = await questionRepo.findOne({
      where: { subject: q.subject, type: q.type },
    });
    if (!existing) {
      existing = await questionRepo.save(questionRepo.create(q));
    }
    savedQuestions.push(existing);
  }

  const mathPaperQuestions = savedQuestions
    .filter((q) => q.subject === 'MATH')
    .map((q) => ({
      id: q.id,
      bankQuestionId: q.id,
      type: q.type,
      content: q.content,
      correctKey: q.correctKey,
      maxScore: Number(q.maxScore),
      partKey: q.type === QuestionType.MCQ ? 'part1_mcq' : q.type === QuestionType.TRUE_FALSE ? 'part2_true_false' : 'part3_short',
    }));

  let mathPaper = await paperRepo.findOne({ where: { comboCode: 'A00', examSessionId: examSession.id, subject: 'MATH' } });
  if (!mathPaper) {
    mathPaper = await paperRepo.save(
      paperRepo.create({
        title: 'Đề Toán - Tổ hợp A00',
        subject: 'MATH',
        comboCode: 'A00',
        examSessionId: examSession.id,
        questions: mathPaperQuestions,
        difficultyMeta: { low: 0, medium: 2, high: 1 },
      }),
    );
  }

  const litPaperQuestions = savedQuestions
    .filter((q) => q.subject === 'LITERATURE')
    .map((q) => ({
      id: q.id,
      bankQuestionId: q.id,
      type: q.type,
      content: q.content,
      correctKey: q.correctKey,
      maxScore: Number(q.maxScore),
      uiMode: 'split_view',
      partKey: 'part1_reading',
    }));

  let litPaper = await paperRepo.findOne({ where: { comboCode: 'D01', examSessionId: examSession.id, subject: 'LITERATURE' } });
  if (!litPaper) {
    litPaper = await paperRepo.save(
      paperRepo.create({
        title: 'Đề Văn - Tổ hợp D01',
        subject: 'LITERATURE',
        comboCode: 'D01',
        examSessionId: examSession.id,
        questions: litPaperQuestions,
        difficultyMeta: { low: 1, medium: 0, high: 0 },
      }),
    );
  }

  for (const sample of GDPT_STREAM_SAMPLES) {
    const existing = await streamRepo.findOne({
      where: { examSessionId: gdptSession.id, streamCode: sample.streamCode },
    });
    if (!existing && getDefaultStructure(sample.subjectCodes[0])) {
      const subject = sample.subjectCodes[0];
      let paper = await paperRepo.findOne({
        where: { examSessionId: gdptSession.id, subject },
      });
      if (!paper && subject === 'MATH') {
        paper = mathPaper;
      }
      await streamRepo.save(
        streamRepo.create({
          examSessionId: gdptSession.id,
          streamCode: sample.streamCode,
          streamName: sample.streamName,
          grade: sample.grade,
          subjectCodes: sample.subjectCodes,
          assessmentPeriod: sample.assessmentPeriod as GdptAssessmentPeriod,
          structureTemplateId: null,
          examPaperId: paper?.id,
        }),
      );
    }
  }

  const now = new Date();
  const slotStart = new Date(now.getTime() - 60 * 60 * 1000);
  const slotEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  for (const student of students.filter((s) => s.comboCode === 'A00')) {
    for (const subject of ['MATH', 'LITERATURE', 'PHYSICS']) {
      if (!getDefaultStructure(subject)) continue;
      const existing = await slotRepo.findOne({
        where: { studentId: student.id, examSessionId: examSession.id, subjectCode: subject },
      });
      if (!existing) {
        await slotRepo.save(
          slotRepo.create({
            studentId: student.id,
            examSessionId: examSession.id,
            subjectCode: subject,
            structureTemplateId: null,
            scheduledStart: slotStart,
            scheduledEnd: slotEnd,
            status: subject === 'MATH' ? 'open' : 'scheduled',
          }),
        );
      }
    }
  }

  const pinHash = await bcrypt.hash('123456', 10);
  let sbdCounter = 1001;
  for (const student of students) {
    const sbd = String(sbdCounter++);
    const existing = await studentSessionRepo.findOne({ where: { sbd, examSessionId: examSession.id } });
    if (!existing) {
      await studentSessionRepo.save(
        studentSessionRepo.create({
          sbd,
          pinHash,
          studentId: student.id,
          examSessionId: examSession.id,
          examPaperId: student.comboCode === 'D01' ? litPaper.id : mathPaper.id,
        }),
      );
    }
  }

  console.log('Seed complete!');
  console.log(`TN THPT Exam Session ID: ${examSession.id}`);
  console.log(`GDPT Exam Session ID: ${gdptSession.id}`);
  console.log('Demo login: SBD 1001-1003, PIN 123456');

  const credPath = path.resolve(__dirname, '../../../../dev-credentials.json');
  const studentPublic = path.resolve(__dirname, '../../../../apps/web/student/public');
  const proctorPublic = path.resolve(__dirname, '../../../../apps/web/proctor/public');
  const cred = {
    tnExamSessionId: examSession.id,
    gdptExamSessionId: gdptSession.id,
    sbdFrom: '1001',
    sbdTo: String(1000 + students.length),
    pin: '123456',
  };
  fs.writeFileSync(credPath, JSON.stringify(cred, null, 2));
  if (!fs.existsSync(studentPublic)) fs.mkdirSync(studentPublic, { recursive: true });
  if (!fs.existsSync(proctorPublic)) fs.mkdirSync(proctorPublic, { recursive: true });
  const credJson = JSON.stringify(cred, null, 2);
  fs.writeFileSync(path.join(studentPublic, 'dev-credentials.json'), credJson);
  fs.writeFileSync(path.join(proctorPublic, 'dev-credentials.json'), credJson);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
