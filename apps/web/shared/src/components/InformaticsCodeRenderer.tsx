import type { InformaticsCodeBlock } from '@vnu/shared-types';
import { DualCodeBlockView } from './DualCodeBlockView';

interface Props {
  codeBlocks?: InformaticsCodeBlock[];
  codeDisplay?: 'tabs' | 'side_by_side';
}

export function InformaticsCodeRenderer({ codeBlocks, codeDisplay }: Props) {
  if (!codeBlocks?.length) return null;
  return (
    <div className="informatics-code-section">
      <DualCodeBlockView blocks={codeBlocks} display={codeDisplay} />
    </div>
  );
}
