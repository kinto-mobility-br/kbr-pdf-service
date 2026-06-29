import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePdf } from '../index.js';

async function main(): Promise<void> {
  const buffer = await generatePdf({
    config: {
      headerTitle: 'KINTO Code Quality Report',
      coverKicker: 'TECHNICAL AUDIT',
      coverTitle: 'Code Analysis Report',
      footerText: '© KINTO MOBILITY · AUDITORIA TÉCNICA CONFIDENCIAL',
    },
    metadata: [
      { label: 'Project', value: 'kbr-pdf-service' },
      { label: 'Repository', value: 'kinto/kbr-pdf-service' },
      { label: 'PR', value: '#1', link: 'https://github.com/kinto/kbr-pdf-service/pull/1' },
      { label: 'Commit', value: 'a1b2c3d4e5f6' },
      { label: 'Date', value: new Date().toLocaleDateString('en-US') },
    ],
    summary:
      'Demonstração do KBR PDF Service. Este relatório foi gerado automaticamente para validar o template visual com branding KINTO.',
    summaryTitle: 'Executive Summary',
    overviewCards: [
      { label: 'Security', value: 2 },
      { label: 'Performance', value: 1 },
      { label: 'Quality', value: 3 },
      { label: 'Total', value: 6 },
    ],
    sections: [
      {
        title: 'Security Issues',
        descriptor: 'Findings that may compromise security, reliability, or correctness.',
        items: [
          {
            title: 'Hardcoded API key in source',
            description:
              'API key found in plain text. This allows anyone with access to the repository to impersonate the service.',
            suggestion: 'Move to AWS SSM Parameter Store (SecureString) and fetch at runtime.',
            file: 'src/config.ts',
            line: 12,
            severity: 'high',
          },
          {
            title: 'Missing input validation',
            description: 'User input is passed directly to database query without sanitization.',
            suggestion: 'Add zod schema validation at the handler boundary.',
            file: 'src/handler.ts',
            line: 34,
            severity: 'medium',
          },
        ],
      },
      {
        title: 'Performance',
        descriptor: 'Optimization opportunities and costly patterns.',
        items: [
          {
            title: 'N+1 database queries in loop',
            description:
              'Each iteration of the processing loop makes an individual DB call. For 100 items this results in 100 queries.',
            suggestion: 'Batch queries using IN clause or DynamoDB BatchGetItem.',
            file: 'src/services/processor.ts',
            line: 67,
            severity: 'medium',
          },
        ],
      },
      {
        title: 'Code Quality',
        items: [
          {
            title: 'TypeScript any in 8 locations',
            description: 'Usage of `any` suppresses type safety and hides potential bugs.',
            suggestion: 'Replace with proper interfaces or unknown + type guards.',
          },
          {
            title: 'Dead code: unused imports',
            description: 'Multiple files import symbols that are never used.',
            severity: 'low',
          },
          {
            title: 'Missing error handling in async flow',
            description: 'Promise chain does not have .catch() handler, causing unhandled rejections.',
            suggestion: 'Wrap in try/catch or use neverthrow ResultAsync.',
            file: 'src/jobs/sync.ts',
            line: 22,
            severity: 'low',
          },
        ],
      },
    ],
  });

  const tmpDir = resolve(process.cwd(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = resolve(tmpDir, `demo-${timestamp}.pdf`);
  writeFileSync(outputPath, buffer);
  console.log(`PDF gerado: ${outputPath} (${buffer.length} bytes)`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
