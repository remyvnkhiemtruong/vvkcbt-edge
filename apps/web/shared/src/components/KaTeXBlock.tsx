import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
  displayMode?: boolean;
}

export function KaTeXBlock({ content, displayMode = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(content, ref.current, { throwOnError: false, displayMode });
      } catch {
        if (ref.current) ref.current.textContent = content;
      }
    }
  }, [content, displayMode]);

  return <span ref={ref} />;
}
