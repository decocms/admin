/* eslint-disable ban-memoization/ban-memoization */
import { useCallback, useState } from "react";

export function useCopy() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return { handleCopy, copied };
}
