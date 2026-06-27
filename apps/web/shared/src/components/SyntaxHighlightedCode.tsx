import { useMemo } from 'react';
import { highlightCodeSource } from '../utils/highlight-code';

export function SyntaxHighlightedCode({
  source,
  language,
  className,
}: {
  source: string;
  language?: string;
  className?: string;
}) {
  const { html, lang } = useMemo(
    () => highlightCodeSource(source, language),
    [source, language],
  );

  return (
    <pre className={className ?? `rich-code-block rich-code-block--${lang}`}>
      <code
        className={`hljs language-${lang}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}
