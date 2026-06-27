import type { InformaticsCodeBlock } from '@vnu/shared-types';
import { DualCodeBlockView } from './DualCodeBlockView';
import { filledCodeBlocks } from '../utils/code-blocks';

interface Props {
  codeBlocks?: InformaticsCodeBlock[];
  codeDisplay?: 'tabs' | 'side_by_side';
}

export function InformaticsCodeRenderer({ codeBlocks, codeDisplay }: Props) {
  const filled = filledCodeBlocks(codeBlocks);
  if (!filled.length) return null;
  return (
    <div className="informatics-code-section">
      <DualCodeBlockView
        blocks={filled}
        display={filled.length > 1 ? codeDisplay : undefined}
      />
    </div>
  );
}
