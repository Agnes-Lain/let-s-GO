import { formatNumber, formatParams } from './format';

describe('formatNumber (§9: French decimals use a comma)', () => {
  it('formats 5.5 per language', () => {
    expect(formatNumber(5.5, 'fr')).toBe('5,5');
    expect(formatNumber(5.5, 'en')).toBe('5.5');
    expect(formatNumber(5.5, 'zh-CN')).toBe('5.5');
    expect(formatNumber(12, 'fr')).toBe('12');
  });

  it('formats every number param of a note', () => {
    expect(formatParams({ key: 'k', params: { margin: 3.5, point: 'e5' } }, 'fr')).toEqual({
      margin: '3,5',
      point: 'e5',
    });
    expect(formatParams({ key: 'k' }, 'fr')).toBeUndefined();
  });
});
