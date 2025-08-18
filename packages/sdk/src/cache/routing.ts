import { SWRCache } from './swr.ts';

const FIVE_SECONDS = 5;

export const domainSWRCache = new SWRCache<string | null>('domain-swr', {
  staleTtlSeconds: FIVE_SECONDS,
});

export const purge = async (...domains: string[]): Promise<void> => {
  await Promise.all(domains.map((domain) => domainSWRCache.delete(domain)));
};
