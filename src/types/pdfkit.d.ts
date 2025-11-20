declare module 'pdfkit' {
  import { Stream } from 'stream';

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number | { top?: number; bottom?: number; left?: number; right?: number };
    bufferPages?: boolean;
  }

  class PDFDocument extends Stream {
    constructor(options?: PDFDocumentOptions);
    
    font(font: string): this;
    fontSize(size: number): this;
    text(text: string, options?: { align?: string; lineGap?: number; continued?: boolean }): this;
    moveDown(amount?: number): this;
    registerFont(name: string, src: string | Buffer): void;
    end(): void;
    
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }

  export = PDFDocument;
}

