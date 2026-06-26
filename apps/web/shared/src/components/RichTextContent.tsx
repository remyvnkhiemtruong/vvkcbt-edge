import { Fragment, type ReactNode } from 'react';
import { KaTeXBlock } from './KaTeXBlock';
import { INLINE_TOKEN_RE } from '../utils/rich-text-parser';

const FENCED_CODE_RE = /```(\w+)?\n?([\s\S]*?)```/g;

function imageSrc(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('http') || trimmed.startsWith('/')) return trimmed;
  return `/api/uploads/${trimmed.replace(/^uploads\//, '')}`;
}

function audioSrc(path: string): string {
  return imageSrc(path);
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(INLINE_TOKEN_RE);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <KaTeXBlock key={key} content={part.slice(2, -2)} displayMode />;
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      return <KaTeXBlock key={key} content={part.slice(1, -1)} />;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <u key={key}>{part.slice(2, -2)}</u>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rich-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    const imgMatch = /^\[Ảnh:\s*(.+)\]$/.exec(part);
    if (imgMatch) {
      return (
        <img
          key={key}
          src={imageSrc(imgMatch[1])}
          alt=""
          className="rich-image"
          style={{ maxWidth: '100%', margin: '0.5rem 0' }}
        />
      );
    }
    const audioMatch = /^\[Audio:\s*(.+)\]$/.exec(part);
    if (audioMatch) {
      return (
        <audio
          key={key}
          controls
          preload="none"
          src={audioSrc(audioMatch[1])}
          className="rich-audio"
          style={{ display: 'block', margin: '0.5rem 0', maxWidth: '100%' }}
        />
      );
    }
    if (!part) return null;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function renderTextBlock(text: string, keyPrefix: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => (
    <Fragment key={`${keyPrefix}-l${li}`}>
      {li > 0 && <br />}
      {renderInline(line, `${keyPrefix}-l${li}`)}
    </Fragment>
  ));
}

function renderFencedCode(lang: string | undefined, source: string, key: string) {
  const language = lang?.toLowerCase() ?? '';
  return (
    <pre key={key} className={`rich-code-block rich-code-block--${language || 'plain'}`}>
      <code className={language ? `language-${language}` : undefined}>{source.replace(/\n$/, '')}</code>
    </pre>
  );
}

interface Props {
  content: string;
  className?: string;
}

export function RichTextContent({ content, className }: Props) {
  if (!content) return null;

  const blocks: ReactNode[] = [];
  let lastIndex = 0;
  let blockIdx = 0;
  const re = new RegExp(FENCED_CODE_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) {
      blocks.push(
        <span key={`t${blockIdx++}`} className="rich-text-block">
          {renderTextBlock(before, `b${blockIdx}`)}
        </span>,
      );
    }
    blocks.push(renderFencedCode(match[2], match[3] ?? '', `c${blockIdx++}`));
    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail || blocks.length === 0) {
    blocks.push(
      <span key={`t${blockIdx}`} className="rich-text-block">
        {renderTextBlock(tail, `b${blockIdx}`)}
      </span>,
    );
  }

  return <span className={className ? `rich-text ${className}` : 'rich-text'}>{blocks}</span>;
}

/** Escape HTML for PDF/server rendering */
export function richTextToHtml(content: string): string {
  if (!content) return '';

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inlineToHtml = (line: string) => {
    let h = escape(line);
    h = h.replace(/\$\$([^$]+)\$\$/g, '<div class="katex-display">$$$1$$</div>');
    h = h.replace(/\$([^$]+)\$/g, '<span class="katex-inline">$$$1$$</span>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    h = h.replace(/__([^_]+)__/g, '<u>$1</u>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(
      /\[Ảnh:\s*([^\]]+)\]/g,
      (_, p) => `<img src="${imageSrc(p)}" style="max-width:100%" />`,
    );
    h = h.replace(
      /\[Audio:\s*([^\]]+)\]/g,
      (_, p) => `<audio controls src="${audioSrc(p)}"></audio>`,
    );
    return h;
  };

  const parts: string[] = [];
  let lastIndex = 0;
  const re = new RegExp(FENCED_CODE_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) {
      parts.push(
        before
          .split('\n')
          .map((line) => inlineToHtml(line))
          .join('<br/>'),
      );
    }
    const lang = match[2] ?? '';
    const src = escape(match[3] ?? '').replace(/\n$/, '');
    parts.push(
      `<pre class="rich-code-block rich-code-block--${lang || 'plain'}"><code class="language-${lang}">${src}</code></pre>`,
    );
    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail || parts.length === 0) {
    parts.push(
      tail
        .split('\n')
        .map((line) => inlineToHtml(line))
        .join('<br/>'),
    );
  }

  return parts.join('');
}
