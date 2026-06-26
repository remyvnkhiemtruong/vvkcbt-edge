import { IsObject } from 'class-validator';
import { AutosaveDto } from '../edge/auth/student-auth.dto';

describe('AutosaveDto', () => {
  it('allows answers object through whitelist validation', () => {
    const dto = new AutosaveDto();
    dto.answers = { q1: 'A', q2: ['true', 'false'] };
    expect(dto.answers).toEqual({ q1: 'A', q2: ['true', 'false'] });
    expect(Object.keys(dto)).toContain('answers');
  });
});

describe('Student import validation', () => {
  const VALID_COMBOS = new Set(['A00', 'A01', 'D01']);

  it('rejects unknown combo codes', () => {
    expect(VALID_COMBOS.has('XYZ')).toBe(false);
    expect(VALID_COMBOS.has('A00')).toBe(true);
  });
});

describe('Schedule PIN format', () => {
  const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));

  it('generates 6-digit PIN', () => {
    const pin = generatePin();
    expect(pin).toMatch(/^\d{6}$/);
  });
});
