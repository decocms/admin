import { useRef, useState } from "react";
import { toast } from "sonner";

interface UseCopyProps {
  timeout?: number;
}

export function useCopy({ timeout = 1200 }: UseCopyProps = {}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    // @ts-ignore - setTimeout returns number in browser
    timeoutRef.current = setTimeout(() => setCopied(false), timeout);
    toast.success("Copied to clipboard");
  };

  return {
    handleCopy,
    copied,
  };
}
