import type { InformaticsCodeBlock } from '@vnu/shared-types';

/** Chỉ giữ đoạn code có nội dung — ô trống không hiện trong câu hỏi. */
export function filledCodeBlocks(blocks?: InformaticsCodeBlock[] | null): InformaticsCodeBlock[] {
  if (!blocks?.length) return [];
  return blocks.filter((b) => String(b.source ?? '').trim().length > 0);
}
