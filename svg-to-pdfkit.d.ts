declare module 'svg-to-pdfkit' {
  import type PDFDocument from 'pdfkit';

  interface SvgToPdfOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    useCSS?: boolean;
    fontCallback?: (family: string, bold: boolean, italic: boolean, options: unknown) => string;
    imageCallback?: (link: string) => string;
    colorCallback?: (color: [number, number, number], opacity: number) => [string, number];
    warningCallback?: (warning: string) => void;
    assumePt?: boolean;
    precision?: number;
  }

  function SVGtoPDF(
    doc: InstanceType<typeof PDFDocument>,
    svg: string,
    x?: number,
    y?: number,
    options?: SvgToPdfOptions,
  ): void;

  export default SVGtoPDF;
}
