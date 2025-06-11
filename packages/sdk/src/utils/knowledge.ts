import { WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH } from "../constants.ts";

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

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getKnowledgeBaseIntegrationId = (index: string) =>
  `${WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH}-${index}`;
