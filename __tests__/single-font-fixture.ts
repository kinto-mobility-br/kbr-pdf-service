import type { PdfReportInput } from '../types.js';

/** Relatório completo (capa, resumo, cards com ícone/badge/linhas, tabelas, rodapé) com texto com e sem acento. */
export function buildFullReport(): PdfReportInput {
  return {
    config: {
      headerTitle: 'KINTO Comissões',
      reference: 'PR #123 · abc1234',
      coverKicker: 'RELATÓRIO FINANCEIRO',
      coverTitle: 'Relatório de Comissão',
      footerText: '© KINTO MOBILITY · DOCUMENTO CONFIDENCIAL',
      orientation: 'landscape',
    },
    metadata: [
      { label: 'Período', value: '01/09/2026 a 30/09/2026' },
      { label: 'Dealer', value: 'Concessionária Exemplo LTDA' },
      { label: 'Codigo', value: 'ABC-123' },
    ],
    summaryTitle: 'Resumo',
    summary: 'Relatório de comissão da concessionária no período, com 3 lançamentos.',
    overviewCards: [
      { label: 'Total de comissão', value: 'R$ 1.200,00' },
      { label: 'Lançamentos', value: 3 },
    ],
    sections: [
      {
        title: 'Resumo',
        descriptor: 'Visão geral dos valores',
        tables: [
          {
            title: 'Total geral',
            dense: true,
            columns: [
              { key: 'label', label: 'Tipo', width: 0.5 },
              { key: 'value', label: 'Total comissão', width: 0.5, align: 'right' },
            ],
            rows: [
              { cells: { label: 'Veículos dealers', value: 'R$ 1.000,00' } },
              { cells: { label: 'Estornos', value: 'R$ 200,00' } },
              { cells: { label: 'Total a receber', value: 'R$ 800,00' }, bold: true },
            ],
          },
          {
            title: 'Simples',
            columns: [
              { key: 'a', label: 'Ref' },
              { key: 'b', label: 'Valor' },
            ],
            rows: [{ cells: { a: 'INV-1', b: 'R$ 1,00' } }],
          },
        ],
      },
      {
        title: 'Lançamentos',
        items: [
          {
            title: 'Concessionária Exemplo - INV-1',
            description: 'Locação acima de 15 dias',
            titleIcon: 'KINTO_BLUE',
            severity: 'high',
            rows: [
              { label: 'Duração total', value: 'R$ 1.000,00' },
              { label: 'Desconto por duração', description: 'Locação', value: 'R$ 120,00', dividerBefore: true },
              { label: 'Comissão', value: 'R$ 880,00', bold: true },
            ],
            suggestion: 'Conferir a descrição do lançamento.',
          },
          {
            title: 'Concessionaria Sem Acento - INV-2',
            description: 'Sem acento algum',
            rows: [
              { label: 'Valor liquido', value: 'R$ 500,00' },
              { label: 'Comissao', value: 'R$ 75,00', bold: true },
            ],
          },
        ],
      },
    ],
  };
}
