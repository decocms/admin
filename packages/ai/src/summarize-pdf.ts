import { extractText } from "unpdf";

// Re-export PDF summarization features for external usage
export {
  shouldSummarizePDFs,
  summarizePDFMessages,
} from "./agent/summarize-pdf.ts";

export default {};
