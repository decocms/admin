export type FileExt = ".pdf" | ".txt" | ".md" | ".csv" | ".json";
const allowedTypes: FileExt[] = [".pdf", ".txt", ".md", ".csv", ".json"];

export const isAllowedFileExt = (ext: string): ext is FileExt =>
  allowedTypes.includes(ext as FileExt);

export type ContentType =
  | "application/pdf"
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/csv"
  | "application/json";
const allowedContentTypes = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
  "application/json",
];

export const isAllowedContentType = (
  contentType: string,
): contentType is ContentType => allowedContentTypes.includes(contentType);
