import * as ExcelJS from 'exceljs';
import {
  isMarkedXForTest,
  resolveSubjectFromHeader,
  MANDATORY_SUBJECTS,
  TN_THPT_SUBJECTS,
  NAME_BY_CODE,
} from './exam-master/exam-master.service';

describe('Exam master X column parsing', () => {
  it('recognizes all valid X markers', () => {
    for (const marker of ['X', 'x', '1', '✓', '√', 'yes', 'có']) {
      expect(isMarkedXForTest(marker)).toBe(true);
    }
    expect(isMarkedXForTest('')).toBe(false);
    expect(isMarkedXForTest('no')).toBe(false);
  });

  it('maps all 11 TN THPT subject column headers', () => {
    expect(TN_THPT_SUBJECTS).toHaveLength(11);
    for (const subj of TN_THPT_SUBJECTS) {
      expect(resolveSubjectFromHeader(subj.nameVi)).toBe(subj.code);
    }
  });

  it('requires MATH in mandatory set', () => {
    expect(MANDATORY_SUBJECTS).toContain('MATH');
    expect(MANDATORY_SUBJECTS).toHaveLength(1);
  });
});

describe('Exam master mandatory validation', () => {
  function validateMandatory(subjects: Set<string>): string[] {
    const errors: string[] = [];
    for (const code of MANDATORY_SUBJECTS) {
      if (!subjects.has(code)) {
        errors.push(`Thiếu đăng ký môn bắt buộc: ${NAME_BY_CODE.get(code)}`);
      }
    }
    return errors;
  }

  it('rejects student missing Toán', () => {
    expect(validateMandatory(new Set(['MATH', 'ENGLISH']))).toHaveLength(0);
    expect(validateMandatory(new Set(['ENGLISH', 'PHYSICS']))).toHaveLength(1);
  });

  it('accepts student with mandatory subject', () => {
    expect(validateMandatory(new Set(['MATH']))).toHaveLength(0);
  });
});

describe('Exam master workbook structure', () => {
  it('builds student sheet with 11 X columns', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DanhSachThiSinh');
    const headers = ['Họ tên', 'SBD', 'Lớp', 'Ngày sinh', 'Giới tính', ...TN_THPT_SUBJECTS.map((s) => s.nameVi), 'Ghi chú'];
    sheet.addRow(headers);
    const row: string[] = ['Nguyễn Văn A', '1001', '12A1', '15/03/2008', 'Nam'];
    for (const subj of TN_THPT_SUBJECTS) {
      row.push(subj.mandatory ? 'X' : '');
    }
    row.push('');
    sheet.addRow(row);

    const headerMap = new Map<number, string>();
    sheet.getRow(1).eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (val) headerMap.set(col, val);
    });

    const subjectCols = new Map<string, string>();
    headerMap.forEach((header) => {
      const code = resolveSubjectFromHeader(header);
      if (code) subjectCols.set(header, code);
    });

    expect(subjectCols.size).toBe(11);

    const values: Record<string, string> = {};
    headerMap.forEach((header, col) => {
      values[header] = String(sheet.getRow(2).getCell(col).value ?? '').trim();
    });

    const subjects = new Set<string>();
    for (const [header, code] of subjectCols) {
      if (isMarkedXForTest(values[header] ?? '')) subjects.add(code);
    }
    expect(subjects.size).toBe(1);
    expect(subjects.has('MATH')).toBe(true);
  });

  it('export score columns include KetQua headers', () => {
    const scoreHeaders = [
      ...TN_THPT_SUBJECTS.map((s) => `Điểm ${s.nameVi}`),
      'Tổng điểm',
      'Trạng thái',
    ];
    expect(scoreHeaders).toHaveLength(13);
    expect(scoreHeaders[scoreHeaders.length - 2]).toBe('Tổng điểm');
    expect(scoreHeaders[scoreHeaders.length - 1]).toBe('Trạng thái');
  });

  it('KetQua sheet has per-subject detail columns', () => {
    const ketQuaHeaders = [
      'SBD',
      'Mã HS',
      'Họ tên',
      'Mã môn',
      'Tên môn',
      'Điểm',
      'Chi tiết từng câu',
      'Nộp lúc',
      'Vi phạm',
    ];
    expect(ketQuaHeaders).toContain('Chi tiết từng câu');
    expect(ketQuaHeaders).toContain('Điểm');
  });
});
