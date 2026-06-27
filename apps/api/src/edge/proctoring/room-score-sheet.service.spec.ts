import {
  buildRoomScoreListPdfDefinition,
  flattenPdfContentForTest,
  type RoomScoreSheetRow,
} from '../../shared/admin-docs/room-score-sheet-doc';
import { renderPdfBuffer } from '../../shared/admin-docs/pdf-buffer';
import { RoomScoreSheetService, type RoomScoreSheetQuery } from './room-score-sheet.service';

const sampleRows: RoomScoreSheetRow[] = [
  {
    stt: 1,
    sbd: '120001',
    fullName: 'Nguyễn Văn A',
    className: '12A1',
    part1: 0.75,
    part2: 0.75,
    part3: 0,
    total: 1.5,
    note: '',
  },
];

describe('RoomScoreSheetService', () => {
  const service = new RoomScoreSheetService(
    {} as never,
    {} as never,
    {} as never,
  );

  const baseQuery: RoomScoreSheetQuery = {
    subjectCode: 'MATH',
    room: 'Phòng máy số 1',
    format: 'pdf',
  };

  it('buildMeta returns list metadata', () => {
    const meta = service.buildMeta('KTGK1', baseQuery, 'Toán', { total: 2, completed: 1 });
    expect(meta.examName).toBe('KTGK1');
    expect(meta.subjectName).toBe('Toán');
    expect(meta.room).toBe('Phòng máy số 1');
    expect(meta.submittedCount).toBe(1);
    expect(meta.absentCount).toBe(1);
  });

  it('pdf definition contains only the score table', () => {
    const doc = buildRoomScoreListPdfDefinition(sampleRows);
    const text = flattenPdfContentForTest(doc.content);
    expect(text).toContain('STT');
    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain('120001');
    expect(text).not.toContain('Danh sách điểm');
    expect(text).not.toContain('Kỳ thi');
    expect(text).not.toContain('Tổng kết');
    expect(text).not.toContain('BIÊN BẢN');
    expect(text).not.toContain('Giám thị');
  });

  it('renders valid PDF buffer', async () => {
    const doc = buildRoomScoreListPdfDefinition(sampleRows);
    const buffer = await renderPdfBuffer(doc);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  }, 30000);
});
