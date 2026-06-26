import { useCallback, useEffect, useState } from 'react';

export type ExamThemePreference = 'light' | 'dark' | 'system';
export type ExamTheme = 'light' | 'dark';

const STORAGE_KEY = 'vnu_exam_theme';

function readStoredPreference(): ExamThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function resolveTheme(preference: ExamThemePreference): ExamTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useExamTheme() {
  const [preference, setPreferenceState] = useState<ExamThemePreference>(readStoredPreference);
  const [theme, setTheme] = useState<ExamTheme>(() => resolveTheme(readStoredPreference()));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setTheme(resolveTheme(preference));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = useCallback((next: ExamThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
    setTheme(resolveTheme(next));
  }, []);

  const toggle = useCallback(() => {
    const next: ExamThemePreference = theme === 'light' ? 'dark' : 'light';
    setPreference(next);
  }, [theme, setPreference]);

  return { theme, preference, setPreference, toggle, isDark: theme === 'dark' };
}
