import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import cpp from 'highlight.js/lib/languages/cpp';

hljs.registerLanguage('python', python);
hljs.registerLanguage('cpp', cpp);

const LANG_ALIASES: Record<string, string> = {
  python: 'python',
  py: 'python',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
};

const REGISTERED = new Set(['python', 'cpp']);

export function normalizeHighlightLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const key = language.trim().toLowerCase();
  return LANG_ALIASES[key] ?? key;
}

export function highlightCodeSource(source: string, language?: string): { html: string; lang: string } {
  const normalized = normalizeHighlightLanguage(language);
  const text = source.replace(/\n$/, '');

  if (normalized && REGISTERED.has(normalized)) {
    try {
      return { html: hljs.highlight(text, { language: normalized }).value, lang: normalized };
    } catch {
      /* fall through */
    }
  }

  try {
    const auto = hljs.highlightAuto(text, [...REGISTERED]);
    return { html: auto.value, lang: auto.language ?? normalized ?? 'plain' };
  } catch {
    return {
      html: text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),
      lang: normalized ?? 'plain',
    };
  }
}
