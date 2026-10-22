import { formatNumber, SIGNIFICANT_DIGITS } from './formatNumber'

describe('formatNumber', () => {
  it.each([
    [5, '5'],
    [-3, '-3'],
    [0, '0'],
    [3.75, '3.75'],
    [1234567, '1234567'],
  ])('leaves %s as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it('hides binary floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
    expect(formatNumber(1.1 + 2.2)).toBe('3.3')
  })

  it('trims trailing zeros left by rounding', () => {
    expect(formatNumber(2.5000000000001)).toBe('2.5')
    expect(formatNumber(10)).toBe('10')
  })

  it(`keeps ${SIGNIFICANT_DIGITS} significant digits`, () => {
    expect(formatNumber(1.23456789012345)).toBe('1.23456789012')
    expect(formatNumber(123456789012.345)).toBe('123456789012')
  })

  it('shows negative zero as zero', () => {
    expect(formatNumber(-0)).toBe('0')
  })

  it('uses exponent notation for very large and very small magnitudes', () => {
    expect(formatNumber(1.5e300)).toBe('1.5e+300')
    expect(formatNumber(2e-9)).toBe('2e-9')
  })
})
