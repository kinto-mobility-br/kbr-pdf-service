import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePdf } from '../index.js';
import type { PdfTableColumn, PdfTableRow } from '../types.js';

/**
 * Harness local (T2/CA008) para validar visualmente o layout das tabelas-resumo do
 * relatório de comissão: 3 tabelas empilhadas (veículos dealers, veículos kinto, total
 * geral) numa página de resumo em paisagem, com uma tabela longa que QUEBRA de página
 * para checar a repetição do cabeçalho e o espaçamento entre tabelas. Dados mockados.
 *
 * Uso: npm run commission-demo  → gera tmp/commission-summary-demo.pdf
 */

const SUMMARY_COLUMNS: PdfTableColumn[] = [
  { key: 'ref', label: 'Ref', width: 0.15 },
  { key: 'bruto', label: 'Valor bruto', width: 0.14 },
  { key: 'duracao', label: 'Desconto duração', width: 0.14 },
  { key: 'liquido', label: 'Valor líquido', width: 0.14 },
  { key: 'dealers', label: 'Descontos dealers', width: 0.13 },
  { key: 'percentual', label: 'Porcentagem dealer', width: 0.14 },
  { key: 'comissao', label: 'Total comissão', align: 'right' },
];

const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\u00A0/g, ' ');

/** Gera uma linha-resumo sintética; `negative` força comissão negativa (checar destaque vermelho). */
function summaryRow(index: number, negative = false): PdfTableRow {
  const bruto = 1000 + index * 37.5;
  const duracao = index % 3 === 0 ? 120 : 0;
  const liquido = bruto - duracao;
  const dealers = index % 4 === 0 ? 80 : 0;
  const percentual = 0.15;
  const comissao = negative ? -(liquido * percentual) : liquido * percentual - dealers;
  return {
    cells: {
      ref: `INV-2026-${String(index).padStart(4, '0')}`,
      bruto: brl(bruto),
      duracao: brl(duracao),
      liquido: brl(liquido),
      dealers: brl(dealers),
      percentual: '15%',
      comissao: brl(comissao),
    },
    severity: comissao < 0 ? 'high' : undefined,
  };
}

/** Card detalhado de 1 lançamento (cascata bruto → líquido → comissão); kinto ganha ícone no título. */
function buildDetailCard(dealerName: string, row: PdfTableRow, isKinto: boolean) {
  const comissaoNegativa = row.cells.comissao.includes('-');
  return {
    title: `${dealerName} - ${row.cells.ref}`,
    description: '',
    rows: [
      { label: 'Duracao total', value: row.cells.bruto },
      { label: 'Desconto por duracao', value: row.cells.duracao },
      { label: 'Valor liquido', value: row.cells.liquido, bold: true },
      { label: 'Valor liquido', value: row.cells.liquido, dividerBefore: true },
      { label: 'Percentual aplicado', value: row.cells.percentual },
      { label: 'Desconto do dealer (PROMOCODE)', value: row.cells.dealers, dividerBefore: true },
      { label: 'Comissao', value: row.cells.comissao, bold: true },
    ],
    severity: comissaoNegativa ? 'high' : undefined,
    titleIcon: isKinto ? 'KINTO_BLUE' : undefined,
  };
}

async function main(): Promise<void> {
  // Tabela "dealers" propositalmente longa (45 linhas) para forçar quebra de página.
  const dealerRows: PdfTableRow[] = Array.from({ length: 45 }, (_, i) => summaryRow(i + 1, i === 7));
  const kintoRows: PdfTableRow[] = Array.from({ length: 3 }, (_, i) => summaryRow(100 + i));
  const sumCommission = (rows: PdfTableRow[]): number =>
    rows.reduce((sum, row) => {
      const raw = row.cells.comissao.replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.');
      return sum + Number(raw);
    }, 0);
  const dealerTotal = sumCommission(dealerRows);
  const kintoTotal = sumCommission(kintoRows);
  const totalComissao = dealerTotal + kintoTotal;

  const buffer = await generatePdf({
    config: {
      headerTitle: 'KINTO Dealers Commissions',
      coverKicker: 'RELATORIO FINANCEIRO',
      coverTitle: 'Relatorio de Comissao por Dealer',
      footerText: '(c) KINTO MOBILITY - DOCUMENTO CONFIDENCIAL',
      orientation: 'landscape',
    },
    metadata: [
      { label: 'Periodo', value: '01/09/2026 a 30/09/2026' },
      { label: 'Dealer', value: 'Concessionaria Exemplo LTDA' },
    ],
    summary:
      'Relatorio de comissao da concessionaria Concessionaria Exemplo LTDA para o periodo 01/09/2026 a 30/09/2026, com 48 lancamento(s).',
    overviewCards: [
      { label: 'Total de comissao', value: brl(totalComissao) },
      { label: 'Lancamentos', value: 48 },
    ],
    sections: [
      {
        title: 'Resumo',
        tables: [
          { title: 'Veículos dealers', dense: true, columns: SUMMARY_COLUMNS, rows: dealerRows },
          { title: 'Veículos kinto', dense: true, columns: SUMMARY_COLUMNS, rows: kintoRows },
          {
            title: 'Total geral',
            dense: true,
            columns: [
              { key: 'tipo', label: 'Tipo', width: 0.3 },
              { key: 'valor', label: 'Total comissão', align: 'right' },
            ],
            rows: [
              { cells: { tipo: 'Veículos dealers', valor: brl(dealerTotal) }, severity: dealerTotal < 0 ? 'high' : undefined },
              { cells: { tipo: 'Veículos kinto', valor: brl(kintoTotal) }, severity: kintoTotal < 0 ? 'high' : undefined },
              { cells: { tipo: 'Total geral', valor: brl(totalComissao) }, bold: true, severity: totalComissao < 0 ? 'high' : undefined },
            ],
          },
        ],
      },
      {
        title: 'Lancamentos por dealer',
        items: [
          ...dealerRows.slice(0, 6).map((row) => buildDetailCard('Concessionaria Exemplo LTDA', row, false)),
          ...kintoRows.map((row) => buildDetailCard('Concessionaria Exemplo LTDA', row, true)),
        ],
      },
    ],
  });

  const outDir = resolve(import.meta.dirname, '..', 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'commission-summary-demo.pdf');
  writeFileSync(outPath, buffer);
  // eslint-disable-next-line no-console
  console.log(`PDF gerado: ${outPath} (${buffer.length} bytes)`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
