import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { RoomScoreSheetService, RoomScoreSheetRow } from './room-score-sheet.service';
import { ProctoringGateway } from './proctoring.gateway';

export interface SubjectRoomStats {
  total: number;
  completed: number;
  isComplete: boolean;
}

@Injectable()
export class SubjectRoomCompletionService {
  private readonly emittedKeys = new Set<string>();

  constructor(
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    private readonly roomScoreSheet: RoomScoreSheetService,
    private readonly gateway: ProctoringGateway,
    private readonly configService: ConfigService,
  ) {}

  defaultRoom(): string {
    return this.configService.get<string>('EDGE_ROOM_NAME') || 'Phòng máy số 1';
  }

  private matchesRoom(labRoom: string | null | undefined, room: string): boolean {
    const lab = labRoom?.trim();
    if (!lab) return room === this.defaultRoom();
    return lab === room;
  }

  async getStats(examSessionId: string, subjectCode: string, room: string): Promise<SubjectRoomStats> {
    const slots = await this.slotRepo.find({
      where: { examSessionId, subjectCode },
      relations: ['student'],
    });
    const inRoom = slots.filter((s) => this.matchesRoom(s.student?.labRoom, room));
    const completed = inRoom.filter((s) => s.status === 'completed').length;
    const total = inRoom.length;
    return {
      total,
      completed,
      isComplete: total > 0 && completed === total,
    };
  }

  async checkAfterSubmit(
    examSessionId: string,
    subjectCode: string,
    room?: string,
  ): Promise<boolean> {
    const roomName = room?.trim() || this.defaultRoom();
    const stats = await this.getStats(examSessionId, subjectCode, roomName);
    if (!stats.isComplete) return false;
    return this.emitIfNeeded(examSessionId, subjectCode, roomName, stats, false);
  }

  async forceComplete(
    examSessionId: string,
    subjectCode: string,
    room?: string,
  ): Promise<{ emitted: boolean; stats: SubjectRoomStats; rows: RoomScoreSheetRow[] }> {
    const roomName = room?.trim() || this.defaultRoom();
    const stats = await this.getStats(examSessionId, subjectCode, roomName);
    const rows = await this.roomScoreSheet.getRowsForRoom(examSessionId, subjectCode, roomName);
    const key = this.emitKey(examSessionId, subjectCode, roomName);
    this.emittedKeys.delete(key);
    const emitted = await this.emitIfNeeded(examSessionId, subjectCode, roomName, stats, true);
    return { emitted, stats, rows };
  }

  async preview(
    examSessionId: string,
    subjectCode: string,
    room?: string,
  ): Promise<{ stats: SubjectRoomStats; rows: RoomScoreSheetRow[]; subjectNameVi: string }> {
    const roomName = room?.trim() || this.defaultRoom();
    const stats = await this.getStats(examSessionId, subjectCode, roomName);
    const rows = await this.roomScoreSheet.getRowsForRoom(examSessionId, subjectCode, roomName);
    const subjectNameVi =
      TN_THPT_SUBJECTS.find((s) => s.code === subjectCode)?.nameVi ?? subjectCode;
    return { stats, rows, subjectNameVi };
  }

  private emitKey(examSessionId: string, subjectCode: string, room: string): string {
    return `${examSessionId}:${subjectCode}:${room}`;
  }

  private async emitIfNeeded(
    examSessionId: string,
    subjectCode: string,
    room: string,
    stats: SubjectRoomStats,
    forced: boolean,
  ): Promise<boolean> {
    if (!forced && !stats.isComplete) return false;
    const key = this.emitKey(examSessionId, subjectCode, room);
    if (this.emittedKeys.has(key)) return false;

    const rows = await this.roomScoreSheet.getRowsForRoom(examSessionId, subjectCode, room);
    const subjectNameVi =
      TN_THPT_SUBJECTS.find((s) => s.code === subjectCode)?.nameVi ?? subjectCode;

    this.gateway.emitSubjectRoomComplete({
      examSessionId,
      subjectCode,
      subjectNameVi,
      room,
      stats,
      rows,
      forced,
    });
    this.emittedKeys.add(key);
    return true;
  }
}
