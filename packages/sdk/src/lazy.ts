export const lazy = <T>(fn: () => Promise<T>) => {
  let value: Promise<T> | undefined;
  return async () => {
    if (!value) {
      value = fn();
    }
    return await value;
  };
};
