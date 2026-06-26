import { buildTemplateZip, validateZip } from '@vnu/exam-package-kit';

describe('Composer → Edge ZIP roundtrip (kit)', () => {
  it('11-subject template ZIP passes validateZip with blueprint rules', async () => {
    const zip = await buildTemplateZip();
    const result = await validateZip(zip);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
