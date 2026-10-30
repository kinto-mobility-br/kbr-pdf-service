import { describe, it, expect } from 'vitest';
import { generatePdf } from '../index.js';
import type { PdfTable } from '../types.js';
import { extractTextRuns, findRun } from './pdf-fonts.js';

async function runsOf(tables: PdfTable[]) {
  const buffer = await generatePdf({
    config: { orientation: 'landscape' },
    sections: [{ title: 'Resumo', tables }],
  });
  return extractTextRuns(buffer);
}

const totalsTable = (dense: boolean): PdfTable => ({
  title: 'Total geral',
  dense,
  columns: [
    { key: 'label', label: 'Tipo', width: 0.5 },
    { key: 'value', label: 'Valor', width: 0.5, align: 'right' },
  ],
  rows: [
    { cells: { label: 'Veículos dealers', value: 'R$ 1.000,00' } },
    { cells: { label: 'Comissões', value: 'R$ 800,00' } },
    { cells: { label: 'Estornos', value: 'R$ 200,00' } },
    { cells: { label: 'Total a receber', value: 'R$ 600,00' }, bold: true },
  ],
});

describe('VER030 (RNF007, CA019): consistência tipográfica das tabelas', () => {
  it.each([true, false])(
    'CA019: células de uma mesma coluna usam a mesma família e tamanho (dense=%s), mesmo com acento em só uma',
    async (dense) => {
      const runs = await runsOf([totalsTable(dense)]);
      const labels = ['Veículos dealers', 'Comissões', 'Estornos', 'Total a receber'].map((text) => findRun(runs, text));
      const values = ['R$ 1.000,00', 'R$ 800,00', 'R$ 200,00', 'R$ 600,00'].map((text) => findRun(runs, text));

      for (const column of [labels, values]) {
        expect(new Set(column.map((run) => run.family)).size).toBe(1);
        for (const run of column) expect(run.size).toBeCloseTo(column[0]!.size, 3);
      }
    },
  );

  it('CA019: colunas com e sem acento usam a mesma família (Inter) e o mesmo tamanho', async () => {
    const runs = await runsOf([totalsTable(true)]);
    const withAccent = findRun(runs, 'Veículos dealers');
    const withoutAccent = findRun(runs, 'Estornos');
    const amount = findRun(runs, 'R$ 800,00');

    for (const run of [withAccent, withoutAccent, amount]) expect(run.family).toBe('Inter');
    expect(withAccent.size).toBeCloseTo(withoutAccent.size, 3);
    expect(amount.size).toBeCloseTo(withAccent.size, 3);
  });

  it('CA019: linha bold mantém o peso semibold na mesma família da coluna', async () => {
    const runs = await runsOf([totalsTable(true)]);
    expect(findRun(runs, 'Total a receber').fontName).toBe('Inter-SemiBold');
    expect(findRun(runs, 'Comissões').fontName).toBe('Inter-Regular');
  });

  it.each([true, false])(
    'CA019: todos os cabeçalhos da mesma tabela usam a mesma família e tamanho (dense=%s)',
    async (dense) => {
      const runs = await runsOf([
        {
          title: 'Comissões',
          dense,
          columns: [
            { key: 'ref', label: 'Ref' },
            { key: 'discount', label: 'Desconto duração' },
            { key: 'total', label: 'Total comissão' },
          ],
          rows: [{ cells: { ref: 'INV-1', discount: 'R$ 10,00', total: 'R$ 90,00' } }],
        },
      ]);
      const headers = ['REF', 'DESCONTO DURAÇÃO', 'TOTAL COMISSÃO'].map((text) => findRun(runs, text));

      expect(new Set(headers.map((run) => run.family)).size).toBe(1);
      for (const run of headers) expect(run.size).toBeCloseTo(headers[0]!.size, 3);
    },
  );

  it('retrocompat: tabela sem acento usa Inter (única família do serviço)', async () => {
    const runs = await runsOf([
      {
        title: 'Simples',
        columns: [
          { key: 'a', label: 'Ref' },
          { key: 'b', label: 'Valor' },
        ],
        rows: [{ cells: { a: 'INV-1', b: 'R$ 1,00' } }],
      },
    ]);
    for (const text of ['REF', 'VALOR', 'INV-1', 'R$ 1,00']) expect(findRun(runs, text).family).toBe('Inter');
  });

  it('CA019: no modo dense, o título da tabela fica a pelo menos 8 pt do cabeçalho de colunas', async () => {
    const runs = await runsOf([totalsTable(true)]);
    const title = findRun(runs, 'Total geral');
    const header = findRun(runs, 'TIPO');
    expect(header.top - title.bottom).toBeGreaterThanOrEqual(8);
  });
});
