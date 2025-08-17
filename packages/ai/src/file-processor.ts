import { extractText } from 'unpdf';

export async function analyzePDF(filePath: string): Promise<string> {
  const pdfContent = await extractText(filePath);
  return pdfContent;
}