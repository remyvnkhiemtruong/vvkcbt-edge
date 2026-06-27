import { useMemo, useState } from 'react';
import type { InformaticsCodeBlock } from '@vnu/shared-types';
import { SyntaxHighlightedCode } from './SyntaxHighlightedCode';
import { filledCodeBlocks } from '../utils/code-blocks';

interface Props {
  blocks: InformaticsCodeBlock[];
  display?: 'tabs' | 'side_by_side';
}

const LANG_LABEL: Record<string, string> = {
  cpp: 'C++',
  python: 'Python',
};

function CodePre({ block }: { block: InformaticsCodeBlock }) {
  const lang = block.language?.toLowerCase() ?? '';
  const label =
    block.label ?? `Đoạn chương trình viết bằng ngôn ngữ ${LANG_LABEL[lang] ?? lang}`;
  return (
    <div className="informatics-code-block">
      {label && <div className="informatics-code-block__label">{label}</div>}
      <SyntaxHighlightedCode source={block.source} language={lang} className={`rich-code-block rich-code-block--${lang}`} />
    </div>
  );
}

export function DualCodeBlockView({ blocks, display }: Props) {
  const filled = useMemo(() => filledCodeBlocks(blocks), [blocks]);
  const mode = display ?? (filled.length > 1 ? 'side_by_side' : 'tabs');
  const [active, setActive] = useState(0);

  if (!filled.length) return null;

  if (mode === 'side_by_side' && filled.length > 1) {
    return (
      <div className="informatics-dual-code informatics-dual-code--side">
        {filled.map((b, i) => (
          <CodePre key={i} block={b} />
        ))}
      </div>
    );
  }

  if (filled.length === 1) {
    return <CodePre block={filled[0]} />;
  }

  return (
    <div className="informatics-dual-code informatics-dual-code--tabs">
      <div className="informatics-dual-code__tabs" role="tablist">
        {filled.map((b, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={`informatics-dual-code__tab ${active === i ? 'is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            {LANG_LABEL[b.language] ?? b.language}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <CodePre block={filled[active]} />
      </div>
    </div>
  );
}
