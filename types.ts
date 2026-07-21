/**
 * KBR PDF Service — Tipos genéricos para geração de relatórios PDF com branding Kinto.
 */

/** Campo de metadata exibido na capa do relatório. */
export interface PdfMetadataField {
  label: string;
  value: string;
  link?: string;
}

/** Item genérico de uma seção do relatório. */
export interface PdfSectionItem {
  title: string;
  description: string;
  suggestion?: string;
  file?: string;
  line?: number;
  severity?: 'high' | 'medium' | 'low' | string;
}

/** Coluna de uma tabela de seção (ver `PdfTable`). */
export interface PdfTableColumn {
  /** Chave usada para buscar o valor em `PdfTableRow.cells`. */
  key: string;
  /** Texto exibido no cabeçalho da coluna. */
  label: string;
  /**
   * Largura relativa da coluna (fração de 0 a 1 da largura total da tabela).
   * Colunas sem `width` dividem igualmente o espaço restante.
   */
  width?: number;
}

/** Linha de uma tabela de seção. */
export interface PdfTableRow {
  /** Valor de cada célula, indexado pela `key` da coluna correspondente. */
  cells: Record<string, string>;
  /** Quando definida, destaca a linha (ex.: texto da célula em vermelho para falhas). */
  severity?: 'high' | 'medium' | 'low' | string;
}

/** Tabela exibida em uma seção — alternativa mais compacta aos cards de `PdfSectionItem`. */
export interface PdfTable {
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
}

/**
 * Seção do relatório (equivale a uma "página" de categoria).
 * Exibe `items` como cards (um por item) e/ou `table` como uma tabela
 * compacta (várias linhas por página) — use `table` quando a seção tiver
 * muitos registros simples, para evitar um card por página.
 */
export interface PdfSection {
  title: string;
  descriptor?: string;
  items?: PdfSectionItem[];
  table?: PdfTable;
}

/** Card de overview exibido na base da capa. */
export interface PdfOverviewCard {
  label: string;
  value: string | number;
}

/** Configuração do relatório (textos customizáveis). */
export interface PdfReportConfig {
  /** Texto exibido no header ao lado do logo (default: "KINTO Report") */
  headerTitle?: string;
  /** Referência exibida à direita do header (ex.: "PR #123 · abc1234") */
  reference?: string;
  /** Kicker sobre o título da capa (default: "TECHNICAL REPORT") */
  coverKicker?: string;
  /** Título grande da capa (default: "Report") */
  coverTitle?: string;
  /** Texto do rodapé esquerdo (default: "© KINTO MOBILITY · DOCUMENTO CONFIDENCIAL") */
  footerText?: string;
  /**
   * Senha de abertura do arquivo (user password). Quando definida, o PDF é
   * criptografado (AES-256) e passa a exigir essa senha para ser aberto em
   * qualquer leitor. Deixe indefinido para gerar um PDF sem proteção.
   */
  openPassword?: string;
}

/** Input completo para gerar um relatório PDF. */
export interface PdfReportInput {
  config?: PdfReportConfig;
  metadata?: PdfMetadataField[];
  summary?: string;
  summaryTitle?: string;
  sections?: PdfSection[];
  overviewCards?: PdfOverviewCard[];
}
