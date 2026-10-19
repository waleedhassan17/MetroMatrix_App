import {
  formatIn,
  formatNumber,
  formatQty,
  formatUnitPrice,
  fromBase,
  parseUnit,
  pricePerUnit,
  toBase,
  unitsFor,
} from '../units';
import { directionOf, isUrduScript } from '../script';

describe('units', () => {
  it('shows large weights in kilos, never a big number of grams (QA 12)', () => {
    expect(formatQty(7500, 'g')).toBe('7.5 kg');
    expect(formatQty(5000, 'g')).toBe('5 kg');
    expect(formatQty(750, 'g')).toBe('750 g');
    expect(formatQty(1000, 'g')).toBe('1 kg');
    expect(formatQty(12345, 'g')).toBe('12.35 kg');
    expect(formatQty(1250000, 'g')).toBe('1,250 kg');
  });

  it('shows liquids in litres from a litre up', () => {
    expect(formatQty(1500, 'ml')).toBe('1.5 L');
    expect(formatQty(330, 'ml')).toBe('330 ml');
  });

  it('counts pieces, and dozens when asked and even', () => {
    expect(formatQty(24, 'pc', { dozens: true })).toBe('2 dozen');
    expect(formatQty(18, 'pc', { dozens: true })).toBe('18 pieces');
    expect(formatQty(1, 'pc')).toBe('1 piece');
    expect(formatQty(24, 'pc')).toBe('24 pieces');
  });

  it("uses a kitchen's own unit for whole numbers of it", () => {
    const crate = { name: 'crate', base: 30 };
    expect(formatQty(60, 'pc', { custom: crate })).toBe('2 crate');
    expect(formatQty(45, 'pc', { custom: crate })).toBe('45 pieces');
  });

  it('marks negative stock with a true minus', () => {
    expect(formatQty(-1200, 'g')).toBe('−1.2 kg');
    expect(formatNumber(-0.001)).toBe('0');
  });

  it('converts to and from base units', () => {
    expect(toBase(2.5, 'kg')).toBe(2500);
    expect(toBase(2, 'pao')).toBe(500);
    expect(toBase(3, 'dozen')).toBe(36);
    expect(toBase(1.5, 'l')).toBe(1500);
    expect(toBase(2, { name: 'bori', base: 40000 })).toBe(80000);
    expect(fromBase(2500, 'kg')).toBe(2.5);
    expect(formatIn(2.5, 'kg')).toBe('2.5 kg');
    expect(formatIn(1, 'pc')).toBe('1 piece');
  });

  it('reads unit words in English, Roman Urdu and Urdu script', () => {
    expect(parseUnit('Kilo')).toBe('kg');
    expect(parseUnit('darjan')).toBe('dozen');
    expect(parseUnit('پاؤ')).toBe('pao');
    expect(parseUnit('کلو')).toBe('kg');
    expect(parseUnit('handful')).toBeNull();
    expect(unitsFor('g')).toEqual(['g', 'kg', 'pao']);
  });

  it('quotes prices per kilo, litre or piece', () => {
    expect(formatUnitPrice(0.32, 'g')).toBe('Rs 320 / kg');
    expect(formatUnitPrice(25, 'pc')).toBe('Rs 25 / piece');
    expect(pricePerUnit(450, 2000, 'g')).toBe(225);
  });
});

describe('script', () => {
  it('reads Urdu script right to left', () => {
    expect(isUrduScript('5 کلو ٹماٹر 1200 روپے')).toBe(true);
    expect(directionOf('5 kilo tamatar 1200 rupay')).toBe('ltr');
    expect(isUrduScript('FC-NBNWXT')).toBe(false);
  });
});
