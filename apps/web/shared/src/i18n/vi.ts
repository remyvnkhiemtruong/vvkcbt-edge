export const SCHOOL_NAME =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_SCHOOL_NAME?: string } }).env?.VITE_SCHOOL_NAME) ||
  'THPT Võ Văn Kiệt - Cà Mau';

export const APP_AUTHOR =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_APP_AUTHOR?: string } }).env?.VITE_APP_AUTHOR) ||
  'Trương Minh Khiêm';

export function isProductionUi(): boolean {
  const mode =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: { VITE_UI_MODE?: string } }).env?.VITE_UI_MODE
      : 'production';
  return mode !== 'spec';
}

export const vi = {
  footerDoc: 'Tài liệu Đặc tả Giao diện CBT',
  footerPublic: 'VVKCBT — THPT Võ Văn Kiệt',
  subtitle: 'Hệ thống khảo thí CBT — VVKCBT',
  login: {
    portal: 'CBT',
    title: 'LÀM BÀI THI',
    sbd: 'Số báo danh',
    examAccount: 'Tài khoản thi',
    accountPlaceholder: '123456',
    accountHint: 'Mã in trên phiếu thi (6 chữ số) — không phải SBD',
    pin: 'Mật khẩu',
    pinHint: 'Mã PIN 8 chữ số in trên phiếu thi',
    session: 'Mã ca thi',
    submit: 'XÁC THỰC VÀO PHÒNG CHỜ',
    loading: 'Đang xác thực...',
  },
  rules: {
    title: 'NỘI QUY THI',
    accept: 'Tôi đã đọc và cam kết tuân thủ nội quy thi',
    start: 'BẮT ĐẦU LÀM BÀI',
  },
  exam: {
    loading: 'Đang tải đề thi...',
    submit: 'NỘP BÀI',
    submitConfirm: 'Bạn chắc chắn muốn nộp bài? Sau khi nộp không thể sửa.',
    submitting: 'Đang nộp...',
    locked: 'Bài thi đã bị khóa bởi giám thị',
    focusWarning: 'Cảnh báo: Không được rời khỏi màn hình thi!',
    toggleSplit: 'Chia đôi',
    toggleVertical: 'Cuộn dọc',
    passageTitle: 'NGỮ LIỆU ĐỌC HIỂU',
    timeLabel: 'Thời gian',
    toggleLabel: 'Nút chuyển giao diện',
    on: 'BẬT',
  },
  grace: {
    title: 'ĐANG ĐỒNG BỘ DỮ LIỆU...',
    line1: 'Thời gian làm bài đã kết thúc nhưng kết nối mạng LAN đang bị gián đoạn.',
    line2: 'Bài làm của bạn đã được Auto-save an toàn tại máy tính này.',
    retry: (n: number) =>
      `Background Worker đang Retry nộp bài (Lần ${n})... Vui lòng KHÔNG tắt máy!`,
    networkError: 'Lỗi mạng nội bộ',
    systemStatus: 'TRẠNG THÁI HỆ THỐNG',
  },
  proctor: {
    title: 'CBT - VIEWER',
    room: (n: number, count: number) => `Phòng máy số ${n} | Sĩ số: ${count}`,
    offline: 'RỚT MẠNG',
    violation: 'VI PHẠM TAB',
    empty: 'TRỐNG',
    machine: (n: number) => `Máy ${String(n).padStart(2, '0')}`,
  },
  diagnostic: {
    title: 'KẾT QUẢ QUÉT HỆ THỐNG TRẠM',
    requestChange: 'YÊU CẦU GIÁM THỊ ĐỔI MÁY',
    localStorageOk: 'Quyền ghi LocalStorage: OK (Sẵn sàng Auto-save)',
    lanOk: (ms: number) => `Mạng LAN (Ping): ${ms}ms (Kết nối rất ổn định)`,
    resolutionFail: (w: number, h: number) =>
      `Lỗi Độ phân giải màn hình: ${w}x${h}. Quá thấp, không đủ điều kiện hiển thị giao diện Split-View.`,
  },
  audio: {
    title: (n: number) => `AUDIO BÀI ĐỌC SỐ ${n}`,
    shared: (from: number, to: number) =>
      `Sử dụng chung cho câu hỏi từ ${from} đến ${to}.`,
    regulation: (current: number, max: number) =>
      `* Quy chế bắt buộc: Hệ thống chỉ cấp quyền nghe tối đa ${max} lần. (Lượt hiện tại: ${current}/${max}). Thanh Seek (tua nhanh) đã bị vô hiệu hóa.`,
  },
  machineStatus: {
    active: 'active',
    offline: 'offline',
    warning: 'warning',
    empty: 'empty',
  },
} as const;
