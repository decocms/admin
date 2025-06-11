import { MDocument } from "@mastra/rag";
import { extname } from "@std/path/posix";
import {
  type ContentType,
  type FileExt,
  isAllowedContentType,
  isAllowedFileExt,
} from "../utils/knowledge-file-types.ts";

// File processing types
interface ProcessedDocument {
  filename: string;
  content: string;
  chunks: Awaited<ReturnType<ReturnType<typeof MDocument.fromText>["chunk"]>>;
  metadata: {
    fileType: string;
    fileSize: number;
    chunkCount: number;
    fileHash: string;
  };
}

interface FileProcessorConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export class FileProcessor {
  private config: FileProcessorConfig;

  constructor(config: FileProcessorConfig) {
    this.config = config;
  }

  /**
   * Main entry point - processes a file from URL and returns structured data
   */
  async processFile(fileUrl: string): Promise<ProcessedDocument> {
    // Check if file starts with http or https
    if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
      throw new Error("File URL must start with http:// or https://");
    }

    // Fetch the file from URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
      );
    }

    // Get filename from URL or Content-Disposition header
    const filename = this.extractFilenameFromUrl(fileUrl, response);

    // Create File object from response
    const arrayBuffer = await response.arrayBuffer();
    const file = new File([arrayBuffer], filename, {
      type: response.headers.get("content-type") || "application/octet-stream",
    });

    const fileExt = extname(file.name);

    // Only allow specific file extensions
    if (!isAllowedFileExt(fileExt)) {
      throw new Error(
        `Unsupported file type: ${fileExt}.`,
      );
    }

    const fileHash = await this.generateFileHash(file);

    let content = "";

    switch (fileExt) {
      case ".pdf":
        content = await this.processPDF(file);
        break;
      case ".txt":
      case ".md":
        content = await this.processText(file);
        break;
      case ".csv":
        content = await this.processCSV(file);
        break;
      case ".json":
        content = await this.processJSON(file);
        break;
    }

    const chunks = await this.chunkText(content, fileExt as FileExt);

    return {
      filename: file.name,
      content,
      chunks,
      metadata: {
        fileType: fileExt,
        fileSize: file.size,
        chunkCount: chunks.length,
        fileHash,
      },
    };
  }

  /**
   * Extract filename from URL or Content-Disposition header
   */
  private extractFilenameFromUrl(url: string, response: Response): string {
    // First try to get filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, "");
      }
    }

    // Fallback: extract filename from URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop() || "unknown";

      // If no extension, try to guess from content-type
      if (!filename.includes(".")) {
        const contentType = response.headers.get("content-type");
        const extension = this.getExtensionFromContentType(contentType);
        return `${filename}${extension}`;
      }

      return filename;
    } catch {
      return "unknown.txt";
    }
  }
  /**
   * Get file extension from content-type header
   */
  private getExtensionFromContentType(_contentType: string | null): FileExt {
    const contentType = _contentType?.toLowerCase() ?? "";
    if (!contentType || !isAllowedContentType(contentType)) return ".txt";

    const typeMap: Record<ContentType, FileExt> = {
      "application/pdf": ".pdf",
      "text/plain": ".txt",
      "text/markdown": ".md",
      "text/csv": ".csv",
      "application/csv": ".csv",
      "application/json": ".json",
    };

    return typeMap[contentType];
  }

  /**
   * PDF processing using unpdf library
   * Install: npm install unpdf
   */
  private async processPDF(file: File): Promise<string> {
    const { extractText } = await import("unpdf");
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractText(new Uint8Array(arrayBuffer));
    return text.text.join("");
  }

  /**
   * Plain text processing
   */
  private async processText(file: File): Promise<string> {
    return await file.text();
  }

  /**
   * CSV processing
   */
  private async processCSV(file: File): Promise<string> {
    const text = await file.text();
    const lines = text.split("\n");

    if (lines.length === 0) return "";

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      return obj;
    });

    // Convert to readable format
    return rows.map((row) =>
      Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    ).join("\n");
  }

  /**
   * JSON processing
   */
  private async processJSON(file: File): Promise<string> {
    const text = await file.text();
    const data = JSON.parse(text);

    // Convert JSON to readable text format
    return this.jsonToText(data);
  }

  /**
   * Text chunking with overlap
   */
  private chunkText(text: string, fileExt: FileExt) {
    switch (fileExt) {
      case ".md": {
        return MDocument.fromMarkdown(text).chunk({
          maxSize: this.config.chunkSize,
          headers: [["#", "title"], ["##", "section"]],
        });
      }
      case ".txt":
      case ".csv":
      case ".pdf": {
        return MDocument.fromText(text).chunk({
          maxSize: this.config.chunkSize,
        });
      }
      case ".json": {
        return MDocument.fromJSON(text).chunk({
          maxSize: this.config.chunkSize,
        });
      }
    }
  }

  private async generateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // deno-lint-ignore no-explicit-any
  private jsonToText(obj: Record<any, any>): string {
    return JSON.stringify(obj);
  }
}
