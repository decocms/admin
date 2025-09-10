export type QSParser<T> = {
  [key in keyof Required<T>]: (value: string) => T[key];
};

/**
 * Parse a URLSearchParams object into a typed object.
 *
 * @param searchParams - The URLSearchParams object to parse
 * @param parser - The parser function to use for each key
 * @returns The parsed object
 */
export const qsParser = <T>(parser: QSParser<T>) => ({
  parse: (searchParams: URLSearchParams): T => {
    const result: Partial<T> = {};
    for (const [key, value] of searchParams.entries()) {
      const k = key as keyof T;
      const keyParser = parser[k];
      if (typeof keyParser === "function") {
        result[k] = keyParser(value);
      }
    }
    return result as T;
  },
});
