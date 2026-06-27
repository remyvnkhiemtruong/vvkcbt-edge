/** Đáp án trả lời ngắn TN THPT — tối đa 4 ký tự trên ô nhập. */
export const SHORT_ANSWER_MAX_LEN = 4;

export const SHORT_ANSWER_HINT =
  'Tối đa 4 ký tự: số nguyên, số thập phân, số âm/dương — dùng dấu chấm hoặc phẩy (vd: -2,5)';

/** Mẫu đáp án hoàn chỉnh: âm/dương, nguyên hoặc thập phân, một dấu phân cách thập phân. */
export const SHORT_ANSWER_COMPLETE_PATTERN = /^-?(?:\d+(?:[.,]\d+)?)$/;

/**
 * Lọc ký tự khi gõ: chỉ số, một dấu âm đầu, một dấu chấm/phẩy thập phân; tối đa 4 ký tự.
 */
export function filterShortAnswerInput(raw: string): string {
  let s = raw.replace(/[^\d.,\-]/g, '');
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const sepIdx = s.search(/[.,]/);
  if (sepIdx >= 0) {
    const sep = s[sepIdx];
    const intPart = s.slice(0, sepIdx).replace(/[.,]/g, '');
    const fracPart = s.slice(sepIdx + 1).replace(/[.,]/g, '');
    s = intPart + sep + fracPart;
  }

  const result = (negative ? '-' : '') + s;
  return result.slice(0, SHORT_ANSWER_MAX_LEN);
}

/** Kiểm tra đáp án đã nhập xong (lưu đề / chấm điểm). */
export function isValidShortAnswer(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > SHORT_ANSWER_MAX_LEN) return false;
  return SHORT_ANSWER_COMPLETE_PATTERN.test(trimmed);
}
