import { Fragment } from 'react';
import { KaTeXBlock } from './KaTeXBlock';

const TOKEN_RE =
  /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|\[Ảnh:\s*[^\]]+\])/g;

function imageSrc(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed;
  return `/api/uploads/${trimmed.replace(/^uploads\//, '')}`;
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(TOKEN_RE);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <KaTeXBlock key={key} content={part.slice(2, -2)} displayMode />;
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return <KaTeXBlock key={key} content={part.slice(1, -1)} />;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const imgMatch = /^\[Ảnh:\s*(.+)\]$/.exec(part);
    if (imgMatch) {
      return (
        <img
          key={key}
          src={imageSrc(imgMatch[1])}
          alt=""
          style={{ maxWidth: '100%', margin: '0.5rem 0' }}
        />
      );
    }
    if (!part) return null;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

interface Props {
  content: string;
  className?: string;
}

export function RichTextContent({ content, className }: Props) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {renderInline(line, `l${li}`)}
        </Fragment>
      ))}
    </span>
  );
}

/** Escape HTML for PDF/server rendering */
export function richTextToHtml(content: string): string {
  if (!content) return '';
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split('\n')
    .map((line) => {
      let h = line;
      h = h.replace(/\$\$([^$]+)\$\$/g, '<div class="katex-display">$$$1$$</div>');
      h = h.replace(/\$([^$]+)\$/g, '<span class="katex-inline">$$$1$$</span>');
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      h = h.replace(
        /\[Ảnh:\s*([^\]]+)\]/g,
        (_, p) => `<img src="${imageSrc(p)}" style="max-width:100%" />`,
      );
      return h;
    })
    .join('<br/>');
}
