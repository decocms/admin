import { extractPDFText } from 'unpdf';

export function summarizePDF(filePath: string): string {
  const text = extractPDFText(filePath);
  return text;
}