import { describe, it, expect } from 'vitest';
import { create as createFontkitFont } from 'fontkit';
import { generatePdf, theme, fonts, fallbackFonts } from '../index.js';
import { loadFont, loadFallbackFont } from '../assets-loader.js';
import { getFallbackSizeScale, textsNeedFallback } from '../components/text-fallback.js';
import { extractTextRuns, findRun } from './pdf-fonts.js';
import { buildFullReport } from './single-font-fixture.js';

const WEIGHTS = ['regular', 'light', 'book', 'semibold', 'bold'] as const;

describe('VER030 (RNF007, CA019): fonte única Inter em todos os PDFs', () => {
  it('CA019: nenhum trecho do PDF completo (capa, resumo, cards, tabelas, cabeçalho, rodapé) usa Toyota Type', async () => {
    const runs = extractTextRuns(await generatePdf(buildFullReport()));

    expect(runs.length).toBeGreaterThan(20);
    expect(runs.filter((run) => run.family !== 'Inter').map((run) => `${run.fontName}: ${run.text}`)).toEqual([]);
    expect(runs.some((run) => run.fontName.startsWith('ToyotaType'))).toBe(false);
  });

  it('CA019: textos com e sem acento aparecem na mesma família e no mesmo tamanho', async () => {
    const runs = extractTextRuns(await generatePdf(buildFullReport()));
    const comAcento = findRun(runs, 'Comissão');
    const semAcento = findRun(runs, 'Comissao');

    expect(comAcento.family).toBe('Inter');
    expect(semAcento.family).toBe('Inter');
    expect(comAcento.size).toBeCloseTo(semAcento.size, 3);
    expect(comAcento.fontName).toBe(semAcento.fontName);
  });

  it('CA019: a capa, o cabeçalho e o rodapé renderizam acentos e símbolos (— · © ç ã õ) em Inter', async () => {
    const runs = extractTextRuns(await generatePdf(buildFullReport()));
    const squash = (value: string) => value.replace(/\s+/g, '');
    const allText = squash(runs.map((run) => run.text).join(''));

    for (const expected of ['KINTO Comissões', 'RELATÓRIO FINANCEIRO', 'Relatório de Comissão', 'DOCUMENTO CONFIDENCIAL']) {
      expect(allText).toContain(squash(expected));
    }
    expect(allText).toContain('©');
    expect(allText).toContain('·');
    expect(runs.filter((run) => /[©·ÓãõçÃ]/.test(run.text)).every((run) => run.family === 'Inter')).toBe(true);
  });

  it('CA019: o peso é preservado por papel (bold→Inter-Bold, semibold→Inter-SemiBold, regular→Inter-Regular)', async () => {
    const runs = extractTextRuns(await generatePdf(buildFullReport()));

    expect(findRun(runs, 'Total a receber').fontName).toBe('Inter-SemiBold');
    expect(findRun(runs, 'Veículos dealers').fontName).toBe('Inter-Regular');
    expect(findRun(runs, 'Relatório de Comissão').fontName).toBe('Inter-Bold');
  });

  it('CA019: a API pública é preservada, mas fonte principal e fallback são a mesma Inter (escala 1, sem fallback)', () => {
    expect(fonts.regular).toBe(theme.fonts.regular);
    for (const weight of WEIGHTS) {
      expect(fonts[weight]).toBe(fallbackFonts[weight]);
      expect(fonts[weight]).toMatch(/^inter-/);
      expect(loadFont(weight).equals(loadFallbackFont(weight))).toBe(true);
    }
    expect(getFallbackSizeScale()).toBe(1);
    expect(textsNeedFallback(['Locação acima de 15 dias', 'Comissões'])).toBe(false);
  });

  it('CA019: a Inter possui glifo para todos os caracteres usados pelo serviço e pelo pt-BR', () => {
    const required = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÉÊÍÓÔÕÚÇ—–…·©°ªº$%→•"';
    for (const weight of WEIGHTS) {
      const font = createFontkitFont(loadFont(weight));
      const missing = [...required].filter((char) => !font.hasGlyphForCodePoint(char.codePointAt(0)!));
      expect(missing, `peso ${weight}`).toEqual([]);
    }
  });
});
