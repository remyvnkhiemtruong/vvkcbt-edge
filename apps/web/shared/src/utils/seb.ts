/** Detect Safe Exam Browser — skip duplicate fullscreen when SEB already locks the desktop. */
export function isRunningInSEB(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /SEB|SafeExamBrowser|Safe Exam Browser/i.test(navigator.userAgent);
}
