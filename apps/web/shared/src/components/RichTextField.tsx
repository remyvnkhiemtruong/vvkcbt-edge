import { useRef, useState } from 'react';
import { RichTextContent } from './RichTextContent';
import { wrapSelection } from '../utils/rich-text-parser';

export interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Show KaTeX insert buttons */
  showMath?: boolean;
  /** Show bold / italic / underline */
  showFormatting?: boolean;
  /** Show gap marker buttons for English passages */
  showGapMarkers?: boolean;
  maxGapMarkers?: number;
  /** Image upload handler — returns media token path */
  onUploadImage?: (file: File) => Promise<string | void>;
  showPreview?: boolean;
}

export function RichTextField({
  value,
  onChange,
  rows = 4,
  label,
  placeholder,
  className,
  showMath = true,
  showFormatting = true,
  showGapMarkers = false,
  maxGapMarkers = 6,
  onUploadImage,
  showPreview = true,
}: RichTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);

  const applyWrap = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${before}${after}`);
      return;
    }
    const { value: next, cursor } = wrapSelection(
      value,
      el.selectionStart,
      el.selectionEnd,
      before,
      after,
    );
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${text}`);
      return;
    }
    const start = el.selectionStart;
    const next = value.slice(0, start) + text + value.slice(el.selectionEnd);
    onChange(next);
    const cursor = start + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleImage = async (file: File) => {
    if (!onUploadImage) return;
    setUploading(true);
    try {
      const path = await onUploadImage(file);
      if (path) insertAtCursor(`\n[Ảnh: ${path}]\n`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`rich-text-field ${className ?? ''}`}>
      {label && <label className="rich-text-field__label">{label}</label>}
      <div className="rich-text-field__toolbar" role="toolbar" aria-label="Định dạng văn bản">
        {showFormatting && (
          <>
            <button type="button" className="rich-text-field__btn" title="In đậm" onClick={() => applyWrap('**', '**')}>
              <strong>B</strong>
            </button>
            <button type="button" className="rich-text-field__btn" title="In nghiêng" onClick={() => applyWrap('*', '*')}>
              <em>I</em>
            </button>
            <button type="button" className="rich-text-field__btn" title="Gạch chân" onClick={() => applyWrap('__', '__')}>
              <u>U</u>
            </button>
            <button type="button" className="rich-text-field__btn" title="Mã inline" onClick={() => applyWrap('`', '`')}>
              {'</>'}
            </button>
          </>
        )}
        {showMath && (
          <>
            <button type="button" className="rich-text-field__btn" title="KaTeX inline" onClick={() => insertAtCursor('$x$')}>
              $x$
            </button>
            <button type="button" className="rich-text-field__btn" title="KaTeX display" onClick={() => insertAtCursor('\n$$x^2$$\n')}>
              $$…$$
            </button>
          </>
        )}
        {showGapMarkers &&
          Array.from({ length: maxGapMarkers }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="rich-text-field__btn"
              title={`Chèn chỗ trống {{${n}}}`}
              onClick={() => insertAtCursor(`{{${n}}}`)}
            >
              {`{{${n}}}`}
            </button>
          ))}
        {showGapMarkers && (
          <button type="button" className="rich-text-field__btn" title="Chèn ___" onClick={() => insertAtCursor('___')}>
            ___
          </button>
        )}
        {onUploadImage && (
          <label className="rich-text-field__btn" style={{ cursor: 'pointer' }} title="Chèn ảnh">
            {uploading ? '…' : 'Ảnh'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImage(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="cbt-textarea rich-text-field__input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {showPreview && value.trim() && (
        <div className="rich-text-field__preview">
          <span className="rich-text-field__preview-label">Xem trước</span>
          <RichTextContent content={value} />
        </div>
      )}
    </div>
  );
}
