import { validateExportState } from '@vnu/exam-package-kit';
import type { ExamPackageExportState } from '@vnu/shared-types';

describe('validateExportState (kit)', () => {
  it('rejects export without mandatory subjects', () => {
    const state: ExamPackageExportState = {
      manifest: { formatVersion: '1', packageId: 'x', examName: 't', createdAt: '', mediaManifest: [] },
      session: {
        name: 't',
        routingMode: 'fixed_combo',
        status: 'active',
        durationMin: 90,
        startAt: '',
        rules: {} as never,
      },
      subjects: [],
      students: [{ fullName: 'A', studentCode: '1', className: '12A1', subjects: ['MATH'] }],
      clusters: [],
      papers: {},
    };
    const result = validateExportState(state);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
