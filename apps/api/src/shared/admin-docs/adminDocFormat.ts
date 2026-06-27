export function formatVnDate(d: Date): string {
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

export function formatVnTime(d: Date): string {
  return `${d.getHours()} giờ ${String(d.getMinutes()).padStart(2, '0')} phút`;
}

export function formatMinutesClosing(d: Date): string {
  return `Biên bản kết thúc hồi ${formatVnTime(d)} cùng ngày.`;
}
