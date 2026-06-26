import { useState } from 'react';
import type { InformaticsCodeBlock } from '@vnu/shared-types';

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
      <pre className={`rich-code-block rich-code-block--${lang}`}>
        <code className={lang ? `language-${lang}` : undefined}>{block.source}</code>
      </pre>
    </div>
  );
}

export function DualCodeBlockView({ blocks, display }: Props) {
  const mode = display ?? (blocks.length > 1 ? 'side_by_side' : 'tabs');
  const [active, setActive] = useState(0);

  if (!blocks.length) return null;

  if (mode === 'side_by_side' && blocks.length > 1) {
    return (
      <div className="informatics-dual-code informatics-dual-code--side">
        {blocks.map((b, i) => (
          <CodePre key={i} block={b} />
        ))}
      </div>
    );
  }

  if (blocks.length === 1) {
    return <CodePre block={blocks[0]} />;
  }

  return (
    <div className="informatics-dual-code informatics-dual-code--tabs">
      <div className="informatics-dual-code__tabs" role="tablist">
        {blocks.map((b, i) => (
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
        <CodePre block={blocks[active]} />
      </div>
    </div>
  );
}
