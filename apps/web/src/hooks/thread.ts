export const getThreadId = (threadId?: string) =>
  (threadId || crypto.randomUUID()).slice(0, 8).padStart(8, "0");
