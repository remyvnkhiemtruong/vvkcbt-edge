import { useEffect, useCallback, useState } from 'react';
import { studentApi } from '../api';
import { useExamStore } from '../store';

export function useFocusGuard(enabled: boolean) {
  const [blurred, setBlurred] = useState(false);
  const setViolations = useExamStore((s) => s.setViolations);
  const violations = useExamStore((s) => s.violations);

  const reportViolation = useCallback(async (reason: string) => {
    try {
      const res = await studentApi.focusViolation(reason);
      setViolations(res.violations);
    } catch {
      /* offline */
    }
  }, [setViolations]);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.hidden) {
        setBlurred(true);
        reportViolation('visibility_hidden');
      } else {
        setBlurred(false);
      }
    };

    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        reportViolation('fullscreen_exit');
      }
    };

    const onBlur = () => {
      setBlurred(true);
      reportViolation('window_blur');
    };

    const onFocus = () => setBlurred(false);

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, reportViolation]);

  return { blurred, violations };
}
