import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePdf } from '../index.js';

async function main(): Promise<void> {
  const buffer = await generatePdf({
    config: {
      headerTitle: 'KINTO Brasil API',
      coverKicker: 'DOCUMENTAÇÃO TÉCNICA',
      coverTitle: 'KINTO Brasil API',
      footerText: '© KINTO MOBILITY · DOCUMENTO CONFIDENCIAL',
      // sem valor hardcoded: PDF sem senha se PDF_PASSWORD nao estiver definida
      openPassword: process.env.PDF_PASSWORD,
    },
    metadata: [
      { label: 'Produto', value: 'KINTO Brasil API' },
      { label: 'Data', value: new Date().toLocaleDateString('pt-BR') },
    ],
    summary:
      'A autenticação da Kinto Brazil API usa OAuth2 client_credentials via Amazon Cognito. Cada consumidor recebe um client_id e um client_secret.\n' +
      'Para obter o token, faça um POST para "token_url", com Content-Type application/x-www-form-urlencoded, header Authorization Basic com client_id e client_secret em base64, e no corpo grant_type=client_credentials e scope=xxx (o scope desejado). A resposta traz o access_token e o expires_in em segundos.\n' +
      'O fluxo client_credentials não emite refresh_token. Recomenda-se cachear o token e renová-lo pouco antes do vencimento, em vez de solicitar um novo a cada requisição.\n' +
      'Para chamar os endpoints, envie o header Authorization: Bearer {access_token}.\n' +
      'Token sem o scope exigido pela rota retorna 403 FORBIDDEN. Token ausente, inválido ou expirado retorna 401 UNAUTHORIZED.',
    summaryTitle: 'Autenticação',
  });

  mkdirSync(resolve('tmp'), { recursive: true });
  const outPath = resolve('tmp/kinto-api-auth.pdf');
  writeFileSync(outPath, buffer);
  console.log(`PDF gerado: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
