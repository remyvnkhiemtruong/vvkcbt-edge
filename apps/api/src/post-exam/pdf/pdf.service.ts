import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as puppeteer from 'puppeteer';
import { StudentSession } from '../../database/entities/student-session.entity';

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
  ) {}

  async exportExamPdf(studentSessionId: string): Promise<Buffer> {
    const session = await this.sessionRepo.findOne({
      where: { id: studentSessionId },
      relations: ['examPaper', 'student'],
    });
    if (!session) throw new Error('Session not found');

    const questions = session.examPaper.questions as Array<{
      id: string;
      content: Record<string, unknown>;
      correctKey: unknown;
      type: string;
    }>;
    const answers = session.answers;
    const breakdown = (session.scoreResult?.breakdown ?? []) as Array<{
      questionId: string;
      score: number;
      maxScore: number;
    }>;

    const html = this.renderHtml(session, questions, answers, breakdown);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private stemHtml(content: Record<string, unknown>): string {
    const stem = String(content.stem ?? JSON.stringify(content));
    return this.esc(stem)
      .replace(/\$\$([^$]+)\$\$/g, '<div class="math">$1</div>')
      .replace(/\$([^$]+)\$/g, '<span class="math">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  private renderHtml(
    session: StudentSession,
    questions: Array<{ id: string; content: Record<string, unknown>; correctKey: unknown; type: string }>,
    answers: Record<string, unknown>,
    breakdown: Array<{ questionId: string; score: number; maxScore: number }>,
  ): string {
    const rows = questions
      .map((q, i) => {
        const bd = breakdown.find((b) => b.questionId === q.id);
        const studentAns = this.esc(JSON.stringify(answers[q.id] ?? ''));
        const correct = this.esc(JSON.stringify(q.correctKey));
        const isCorrect = bd && bd.score >= bd.maxScore;
        return `
          <div class="question ${isCorrect ? 'correct' : 'wrong'}">
            <h3>Câu ${i + 1}</h3>
            <div class="stem">${this.stemHtml(q.content)}</div>
            <p><strong>Trả lời:</strong> ${studentAns}</p>
            <p><strong>Đáp án:</strong> ${correct}</p>
            <p><strong>Điểm:</strong> ${bd?.score ?? 0}/${bd?.maxScore ?? 0}</p>
          </div>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; padding: 20px; }
  .correct { border-left: 4px solid green; padding-left: 10px; }
  .wrong { border-left: 4px solid red; padding-left: 10px; }
  .question { margin-bottom: 20px; }
  .math { font-style: italic; }
</style></head><body>
  <h1>Bài thi - SBD: ${this.esc(session.sbd)}</h1>
  <p>Họ tên: ${this.esc(session.student?.fullName ?? '')}</p>
  <p>Tổng điểm: ${session.scoreResult?.total ?? 'Chưa chấm'}</p>
  ${rows}
</body></html>`;
  }
}
