import { extractText } from 'unpdf';

export async function analyzePDF(filePath: string): Promise<string> {
  const pdfContent = await extractText(filePath);

  // `extractText` may return a string or an object like { text: string[] }
  if (typeof pdfContent === 'string') return pdfContent;
  if (pdfContent && Array.isArray((pdfContent as any).text)) {
    return (pdfContent as any).text.join('\n');
  }
  if (pdfContent && typeof (pdfContent as any).text === 'string') {
    return (pdfContent as any).text;
  }

  return '';
}