import { processPDF } from 'unpdf';

export function analyzePDF(filePath: string): string {
  const pdfContent = processPDF(filePath);
  return pdfContent;
}