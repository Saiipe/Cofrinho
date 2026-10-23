import { describe, expect, it } from 'vitest';
import { annualRate, incomeTaxRate, monthlyRate, parseCdiPayload, project, type YieldRule } from './investment';

const turbo: YieldRule = { kind: 'cdi', rate: 115, taxed: true };

describe('yield rules', () => {
  it('applies the CDI percentage to the daily CDI', () => {
    expect(annualRate({ kind: 'cdi', rate: 100, taxed: true }, 13.65)).toBeCloseTo(0.1365, 6);
    expect(annualRate(turbo, 13.65)).toBeCloseTo(0.1585, 3);
    expect(monthlyRate(turbo, 13.65)).toBeCloseTo(0.01234, 4);
  });

  it('converts fixed and savings rates', () => {
    expect(annualRate({ kind: 'yearly', rate: 12, taxed: true }, 13.65)).toBeCloseTo(0.12, 6);
    expect(annualRate({ kind: 'monthly', rate: 1, taxed: true }, 13.65)).toBeCloseTo(0.1268, 4);
    expect(monthlyRate({ kind: 'savings', rate: 0, taxed: false }, 13.65)).toBeCloseTo(0.005, 6);
  });

  it('uses the regressive income tax table', () => {
    expect([30, 180, 181, 360, 361, 720, 721].map(incomeTaxRate)).toEqual([0.225, 0.225, 0.2, 0.2, 0.175, 0.175, 0.15]);
  });
});

describe('project', () => {
  it('compounds monthly and taxes the yield', () => {
    const p = project(100_000, 0, 12, turbo, 13.65);
    expect(p.invested).toBe(100_000);
    expect(p.grossYield).toBe(15_852);
    expect(p.tax).toBe(Math.round(15_852 * 0.175));
    expect(p.netTotal).toBe(p.invested + p.netYield);
  });

  it('taxes each monthly deposit by its own holding time', () => {
    const p = project(0, 10_000, 3, { kind: 'monthly', rate: 1, taxed: true }, 13.65);
    expect(p.invested).toBe(30_000);
    // Deposits held 2, 1 and 0 months: 201 + 100 + 0 of yield, all under the 22.5% bracket.
    expect(p.grossYield).toBe(301);
    expect(p.tax).toBe(68);
  });

  it('does not tax exempt investments', () => {
    expect(project(100_000, 0, 6, { kind: 'savings', rate: 0, taxed: false }, 13.65).tax).toBe(0);
  });
});

describe('parseCdiPayload', () => {
  it('reads the Banco Central series', () => {
    expect(parseCdiPayload([{ data: '21/10/2026', valor: '13.65' }])).toEqual({ rate: 13.65, date: '2026-10-21' });
    expect(parseCdiPayload([])).toBeNull();
    expect(parseCdiPayload({ error: 'x' })).toBeNull();
    expect(parseCdiPayload([{ data: '21/10/2026', valor: 'abc' }])).toBeNull();
  });
});
