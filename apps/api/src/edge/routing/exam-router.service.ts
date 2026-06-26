import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../database/entities/student.entity';
import { ExamPaper } from '../../database/entities/exam-paper.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { GdptSubjectStream } from '../../database/entities/gdpt-subject-stream.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ExamStructureTemplate } from '../../database/entities/exam-structure-template.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { SubjectRoutingConfig } from '@vnu/shared-types';
import { StructureResolverService } from '../../core/structure/structure-resolver.service';

@Injectable()
export class ExamRouterService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ExamPaper)
    private readonly paperRepo: Repository<ExamPaper>,
    @InjectRepository(ExamSession)
    private readonly sessionRepo: Repository<ExamSession>,
    @InjectRepository(GdptSubjectStream)
    private readonly streamRepo: Repository<GdptSubjectStream>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(ExamStructureTemplate)
    private readonly templateRepo: Repository<ExamStructureTemplate>,
    @InjectRepository(StudentSession)
    private readonly studentSessionRepo: Repository<StudentSession>,
    private readonly structureResolver: StructureResolverService,
  ) {}

  /** Định tuyến theo môn — không dùng tổ hợp. */
  async resolvePaper(examSessionId: string, studentId?: string, subjectCode?: string) {
    if (subjectCode) {
      return this.resolvePaperBySubject(examSessionId, subjectCode);
    }

    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new Error('Exam session not found');

    let student: Student | null = null;
    if (studentId) {
      student = await this.studentRepo.findOne({ where: { id: studentId } });
    }

    const group = student?.subjectGroup;
    if (group) {
      const routing = (session.routingConfig || {}) as SubjectRoutingConfig;
      if (routing.subject_map?.[group]) {
        const paper = await this.paperRepo.findOne({ where: { id: routing.subject_map[group] } });
        if (paper) return paper;
      }

      const paper = await this.paperRepo.findOne({
        where: { examSessionId, subject: group },
      });
      if (paper) return paper;
    }

    const routing = (session.routingConfig || {}) as SubjectRoutingConfig;
    if (routing.default_paper_id) {
      const paper = await this.paperRepo.findOne({ where: { id: routing.default_paper_id } });
      if (paper) return paper;
    }

    throw new Error('No exam paper found for student routing');
  }

  async resolvePaperBySubject(examSessionId: string, subjectCode: string) {
    const paper = await this.paperRepo.findOne({
      where: { examSessionId, subject: subjectCode },
    });
    if (!paper) throw new Error(`No exam paper for subject ${subjectCode}`);
    return paper;
  }

  async listSubjectSlots(studentId: string, examSessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    const proctorAtTime = session?.rules?.proctoring?.release_mode === 'proctor_at_time';
    const roomName = process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
    const studentSessions = await this.studentSessionRepo.find({
      where: { studentId, examSessionId },
    });
    const sbdBySubject = new Map(
      studentSessions.filter((ss) => ss.subjectCode).map((ss) => [ss.subjectCode!, ss.sbd]),
    );
    const defaultSbd = studentSessions[0]?.sbd ?? '';

    const slots = await this.slotRepo.find({
      where: { studentId, examSessionId },
      relations: ['structureTemplate'],
      order: { scheduledStart: 'ASC' },
    });

    const now = new Date();
    return slots.map((slot) => {
      let status = slot.status;
      if (!proctorAtTime) {
        if (status === 'scheduled' && now >= slot.scheduledStart && now <= slot.scheduledEnd) {
          status = 'open';
        }
      }
      if (now > slot.scheduledEnd && status !== 'completed') {
        status = 'locked';
      }
      const defaultTpl = this.structureResolver.getDefaultForSubject(slot.subjectCode);
      const tpl = slot.structureTemplate ?? defaultTpl;
      return {
        id: slot.id,
        subjectCode: slot.subjectCode,
        sbd: sbdBySubject.get(slot.subjectCode) ?? defaultSbd,
        labRoom: roomName,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd,
        status,
        structureTemplate: tpl
          ? {
              code: 'code' in tpl ? tpl.code : (tpl as { code: string }).code,
              durationMin: tpl.durationMin,
              uiMode: tpl.uiMode,
            }
          : null,
      };
    });
  }

  async prefetchSlotPaper(studentId: string, examSessionId: string, slotId: string) {
    const slot = await this.slotRepo.findOne({
      where: { id: slotId, studentId, examSessionId },
    });
    if (!slot) throw new Error('Slot not found');

    const paper = await this.paperRepo.findOne({
      where: { examSessionId, subject: slot.subjectCode },
    });
    if (!paper) throw new Error(`No paper for subject ${slot.subjectCode}`);

    return { slot, paper };
  }

  async startSubjectSlot(
    slotId: string,
    studentId: string,
    examSessionId: string,
    studentSessionId?: string,
  ) {
    const slot = await this.slotRepo.findOne({
      where: { id: slotId, studentId, examSessionId },
      relations: ['structureTemplate'],
    });
    if (!slot) throw new Error('Slot not found');

    const now = new Date();
    if (now < slot.scheduledStart) throw new Error('Ca thi chưa mở');
    if (now > slot.scheduledEnd) throw new Error('Ca thi đã kết thúc');
    if (slot.status === 'completed') throw new Error('Môn thi đã hoàn thành');

    const examSession = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    const proctorAtTime = examSession?.rules?.proctoring?.release_mode === 'proctor_at_time';
    if (proctorAtTime && slot.status !== 'open') {
      throw new Error('Đã đến giờ — chờ giám thị mở đề');
    }

    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) throw new Error('Student not found');

    const paper = await this.paperRepo.findOne({
      where: { examSessionId, subject: slot.subjectCode },
    });
    if (!paper) throw new Error(`No paper for subject ${slot.subjectCode}`);

    slot.status = 'open';
    if (studentSessionId) slot.studentSessionId = studentSessionId;
    await this.slotRepo.save(slot);

    return {
      slotId: slot.id,
      paperId: paper.id,
      subject: slot.subjectCode,
      template: slot.structureTemplate ?? this.structureResolver.getDefaultForSubject(slot.subjectCode),
      durationMin:
        slot.structureTemplate?.durationMin ??
        this.structureResolver.getDefaultForSubject(slot.subjectCode).durationMin,
    };
  }

  async completeSubjectSlot(
    slotId: string,
    scoreResult: Record<string, unknown>,
    violationCount = 0,
  ) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new Error('Slot not found');
    slot.scoreResult = scoreResult;
    slot.submittedAt = new Date();
    slot.status = 'completed';
    slot.violationCount = violationCount;
    await this.slotRepo.save(slot);
    return slot;
  }

  async findActiveSlotForSession(studentSessionId: string) {
    return this.slotRepo.findOne({
      where: { studentSessionId, status: 'open' as never },
    });
  }

  async getStructureTemplateForSession(session: ExamSession, subject?: string) {
    if (subject) {
      return this.structureResolver.resolveForSubject(subject, session.rules);
    }
    if (session.rules?.structure_template_id) {
      return this.structureResolver.resolveByTemplateId(session.rules.structure_template_id);
    }
    return null;
  }

  isTnptPersonalized(_session: ExamSession): boolean {
    return false;
  }
}
