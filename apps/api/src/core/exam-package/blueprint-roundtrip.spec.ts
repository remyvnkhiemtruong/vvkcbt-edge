import { buildTemplateZip, validateZip, dryRunZip } from '@vnu/exam-package-kit';

describe('TN THPT 11-subject template ZIP', () => {
  it('buildTemplateZip passes validateZip and dryRunZip (blueprint all subjects)', async () => {
    const buf = await buildTemplateZip();
    const validation = await validateZip(buf);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
    const dry = await dryRunZip(buf);
    expect(dry.passed).toBe(true);
    const blueprintItems = dry.checklist.filter((c) => c.item.startsWith('Blueprint'));
    expect(blueprintItems.length).toBeGreaterThanOrEqual(11);
    expect(blueprintItems.every((c) => c.ok)).toBe(true);
  });
});
