import { useEffect } from 'react';

export function useExamLockdown(enabled: boolean, blockCopyPaste: boolean, blockContextMenu: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (!blockCopyPaste) return;
      if (e.ctrlKey && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const onCopy = (e: Event) => {
      if (blockCopyPaste) e.preventDefault();
    };
    const onContext = (e: Event) => {
      if (blockContextMenu) e.preventDefault();
    };
    const onBeforePrint = () => {
      alert('Không được in đề thi trong phòng thi.');
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onCopy);
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onCopy);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('beforeprint', onBeforePrint);
    };
  }, [enabled, blockCopyPaste, blockContextMenu]);
}
