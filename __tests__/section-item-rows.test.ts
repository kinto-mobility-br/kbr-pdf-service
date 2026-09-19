import { describe, it, expect } from 'vitest';
import { generatePdf } from '../index.js';
import { extractPagesText } from './pdf-text.js';

const PDF_PREFIX = '%PDF-1.';

describe('kbr-pdf-service — PdfSectionItem.rows e suggestionLabel', () => {
  it('CA001 (regressão): item sem rows/suggestionLabel gera o texto de sempre', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Findings',
          items: [
            {
              title: 'Missing validation',
              description: 'Input not validated before processing.',
              suggestion: 'Add zod schema validation.',
            },
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    const allText = extractPagesText(buffer).join('\n');
    expect(allText).toContain('Missing validation');
    expect(allText).toContain('Input not validated before processing.');
    expect(allText).toContain('SUGGESTION');
    expect(allText).toContain('Add zod schema validation.');
  });

  it('CA002: item com rows renderiza uma linha de texto por elemento (label e value)', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Lancamentos',
          items: [
            {
              title: 'Invoice #123',
              rows: [
                { label: 'Deposito - Fatura #123', value: '-R$ 799,42' },
                { label: 'Desconto por duracao', value: '-R$ 312,00' },
              ],
            } as never,
          ],
        },
      ],
    });
    const allText = extractPagesText(buffer).join('\n');
    expect(allText).toContain('Deposito - Fatura #123');
    expect(allText).toContain('-R$ 799,42');
    expect(allText).toContain('Desconto por duracao');
    expect(allText).toContain('-R$ 312,00');
  });

  it('CA003: rows grande o suficiente força nova pagina sem cortar o card', async () => {
    const manyRows = Array.from({ length: 15 }, (_, i) => ({
      label: `Linha de desconto numero ${i}`,
      value: `-R$ ${(i + 1) * 10},00`,
    }));
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Lancamentos',
          items: [
            { title: 'Invoice #1', description: 'Primeiro item, ocupa espaco, empurrando o proximo card para perto do fim da pagina.'.repeat(6) } as never,
            { title: 'Invoice #2 com muitas linhas', rows: manyRows } as never,
          ],
        },
      ],
    });
    const pages = extractPagesText(buffer);
    expect(pages.length).toBeGreaterThan(1);
    const cardPageIndex = pages.findIndex((text) => text.includes('Invoice #2 com muitas linhas'));
    expect(cardPageIndex).toBeGreaterThanOrEqual(0);
    // todas as linhas do card grande devem estar na MESMA pagina (nao cortado ao meio)
    expect(pages[cardPageIndex]).toContain('Linha de desconto numero 0');
    expect(pages[cardPageIndex]).toContain('Linha de desconto numero 14');
  });

  it('CA004: suggestionLabel customizado substitui o rotulo fixo SUGGESTION', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Comissao',
          items: [
            {
              title: 'Invoice #123',
              suggestion: 'Valor liquido x percentual - promocode.',
              suggestionLabel: 'CÁLCULO',
            } as never,
          ],
        },
      ],
    });
    const allText = extractPagesText(buffer).join('\n');
    expect(allText).toContain('CÁLCULO');
    expect(allText).not.toContain('SUGGESTION');
  });

  it('CA005 (regressão): suggestion sem suggestionLabel continua usando SUGGESTION', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Comissao',
          items: [{ title: 'Invoice #123', suggestion: 'Texto qualquer.' }],
        },
      ],
    });
    const allText = extractPagesText(buffer).join('\n');
    expect(allText).toContain('SUGGESTION');
  });

  it('CA006: value de row longo quebra linha sem sobrepor o label', async () => {
    const buffer = await generatePdf({
      sections: [
        {
          title: 'Lancamentos',
          items: [
            {
              title: 'Invoice #123',
              rows: [
                {
                  label: 'Desconto',
                  value: 'Um valor de texto propositalmente muito longo para forcar quebra de linha dentro da coluna direita do card',
                },
              ],
            } as never,
          ],
        },
      ],
    });
    expect(buffer.subarray(0, PDF_PREFIX.length).toString('utf-8')).toBe(PDF_PREFIX);
    const normalizedText = extractPagesText(buffer).join(' ').replace(/\s+/g, ' ');
    expect(normalizedText).toContain('Desconto');
    expect(normalizedText).toContain('forcar quebra de linha');
  });
});
