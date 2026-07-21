import { describe, it, expect } from 'vitest';
import { generatePdf } from '../index.js';
import type { PdfReportInput } from '../types.js';

const PDF_PREFIX = '%PDF-1.';

describe('kbr-pdf-service — generatePdf', () => {
  it('lança erro quando input é null', async () => {
    await expect(generatePdf(null as unknown as PdfReportInput)).rejects.toThrow(
      'PdfReportInput é obrigatório',
    );
  });

  it('lança erro quando input é undefined', async () => {
    await expect(generatePdf(undefined as unknown as PdfReportInput)).rejects.toThrow(
      'PdfReportInput é obrigatório',
    );
  });

  it('lança erro quando não tem summary nem sections', async () => {
    await expect(generatePdf({})).rejects.toThrow(
      'PdfReportInput não contém conteúdo para renderizar',
    );
  });

  it('lança erro quando sections estão vazias', async () => {
    await expect(generatePdf({ sections: [] })).rejects.toThrow(
      'PdfReportInput não contém conteúdo para renderizar',
    );
  });

  it('gera PDF válido com apenas summary', async () => {
    const buffer = await generatePdf({
      summary: 'Relatório gerado com sucesso. Nenhuma pendência identificada.',
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF com summary e config customizada', async () => {
    const buffer = await generatePdf({
      config: {
        headerTitle: 'KINTO Custom Report',
        coverKicker: 'CUSTOM AUDIT',
        coverTitle: 'My Custom Report',
        footerText: '© KINTO · INTERNAL USE ONLY',
      },
      summary: 'Custom report generated successfully.',
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF com metadata fields', async () => {
    const buffer = await generatePdf({
      metadata: [
        { label: 'Project', value: 'KBR Test' },
        { label: 'Author', value: 'Vitest' },
        { label: 'Date', value: '2026-06-26' },
      ],
      summary: 'Report com metadata.',
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF com uma seção de items', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Findings',
          descriptor: 'Issues found during analysis.',
          items: [
            {
              title: 'Missing validation',
              description: 'Input not validated before processing.',
              suggestion: 'Add zod schema validation.',
              file: 'src/handler.ts',
              line: 10,
              severity: 'high',
            },
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    expect(buffer.length).toBeGreaterThan(3000);
  });

  it('gera PDF com uma seção de tabela', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Tentativas de emissão de NFSe',
          descriptor: '3 tentativa(s) de emissão no período — 1 falha(s)',
          table: {
            columns: [
              { key: 'id', label: 'ID Integração', width: 0.22 },
              { key: 'numero', label: 'NFSe Nº', width: 0.14 },
              { key: 'status', label: 'Status', width: 0.2 },
              { key: 'motivo', label: 'Motivo' },
            ],
            rows: [
              { cells: { id: 'k53qxp3/2148036', numero: '-', status: 'Falha (sem dados do cliente)', motivo: 'Sem CPF ou endereço estruturado' }, severity: 'high' },
              { cells: { id: 'lr1po05/2146491', numero: '1234', status: 'Emitida com sucesso', motivo: '-' } },
              { cells: { id: 'k53qg6j/2146852', numero: '-', status: 'Falha (dados inválidos)', motivo: 'Campos faltantes: NFSeTomadorEnderecoNumero' }, severity: 'high' },
            ],
          },
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    expect(buffer.length).toBeGreaterThan(3000);
  });

  it('gera PDF com tabela grande o suficiente pra quebrar página', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Tentativas de emissão de NFSe',
          table: {
            columns: [
              { key: 'id', label: 'ID Integração', width: 0.3 },
              { key: 'status', label: 'Status' },
            ],
            rows: Array.from({ length: 120 }, (_, i) => ({
              cells: { id: `id-${i}/${1000 + i}`, status: i % 5 === 0 ? 'Falha (exceção)' : 'Emitida com sucesso' },
              severity: i % 5 === 0 ? 'high' : undefined,
            })),
          },
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF com múltiplas seções', async () => {
    const buffer = await generatePdf({
      summary: 'Multi-section report.',
      sections: [
        {
          title: 'Security',
          items: [
            { title: 'XSS vulnerability', description: 'Unescaped HTML output.', severity: 'high' },
            { title: 'CSRF missing', description: 'No CSRF token in forms.', severity: 'medium' },
          ],
        },
        {
          title: 'Performance',
          descriptor: 'Performance bottlenecks.',
          items: [
            { title: 'N+1 query', description: 'Database queries in loop.', severity: 'medium' },
          ],
        },
        {
          title: 'Best Practices',
          items: [
            { title: 'No tests', description: 'Zero test coverage.', severity: 'low' },
            { title: 'Magic numbers', description: 'Hardcoded values without constants.' },
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it('gera PDF com overview cards', async () => {
    const buffer = await generatePdf({
      summary: 'Report with overview cards.',
      overviewCards: [
        { label: 'Total', value: 10 },
        { label: 'High', value: 2 },
        { label: 'Medium', value: 5 },
        { label: 'Low', value: 3 },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF completo (config + metadata + summary + sections + overview)', async () => {
    const buffer = await generatePdf({
      config: {
        headerTitle: 'KINTO Full Report',
        coverKicker: 'INTEGRATION TEST',
        coverTitle: 'Complete Report Example',
        reference: 'PR #99 · abc1234',
        footerText: '© KINTO MOBILITY · CONFIDENCIAL',
      },
      metadata: [
        { label: 'Project', value: 'kbr-test' },
        { label: 'Repository', value: 'kinto/kbr-test' },
        { label: 'PR', value: '#99', link: 'https://github.com/kinto/kbr-test/pull/99' },
        { label: 'Commit', value: 'abc1234567890' },
        { label: 'Date', value: '06/26/2026' },
      ],
      summary: 'Análise completa identificou 5 achados distribuídos em 3 categorias. Recomenda-se atenção imediata aos 2 itens de severidade alta.',
      summaryTitle: 'Executive Summary',
      overviewCards: [
        { label: 'Security', value: 2 },
        { label: 'Performance', value: 1 },
        { label: 'Quality', value: 2 },
      ],
      sections: [
        {
          title: 'Security Issues',
          descriptor: 'Findings that may compromise security.',
          items: [
            {
              title: 'Hardcoded API key',
              description: 'API key encontrada em plain text no código fonte.',
              suggestion: 'Mover para AWS SSM Parameter Store (SecureString).',
              file: 'src/config.ts',
              line: 5,
              severity: 'high',
            },
            {
              title: 'Permissão IAM excessiva',
              description: 'Role com s3:* em Resource: *.',
              suggestion: 'Escopar por bucket name e prefixo.',
              file: 'template.yaml',
              line: 45,
              severity: 'high',
            },
          ],
        },
        {
          title: 'Performance',
          items: [
            {
              title: 'Cold start elevado',
              description: 'Lambda com 2.3s de cold start devido a SDK completo.',
              suggestion: 'Usar imports granulares do AWS SDK v3.',
              severity: 'medium',
            },
          ],
        },
        {
          title: 'Code Quality',
          items: [
            { title: 'any em 12 locais', description: 'TypeScript any suprime type safety.' },
            { title: 'Sem error boundary', description: 'Componente React sem error boundary.' },
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    expect(buffer.length).toBeGreaterThan(10000);
  });

  it('tolera severidade desconhecida sem erro', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Custom',
          items: [{ title: 'Item', description: 'Desc', severity: 'critical' }],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('renderiza acentuação pt-BR sem erro', async () => {
    const buffer = await generatePdf({
      summary: 'Análise concluída com êxito. Não há ações urgentes para correção.',
      sections: [
        {
          title: 'Conformidade',
          items: [
            {
              title: 'Configuração de segurança',
              description: 'Atenção à validação de certificados TLS.',
              severity: 'low',
            },
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('ignora seções com items vazios', async () => {
    const buffer = await generatePdf({
      summary: 'Report.',
      sections: [
        { title: 'Empty', items: [] },
        { title: 'Has Items', items: [{ title: 'One', description: 'Desc' }] },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });

  it('gera PDF com summaryTitle customizado', async () => {
    const buffer = await generatePdf({
      summary: 'Vehicle inspection completed.',
      summaryTitle: 'Inspection Summary',
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
  });
});
