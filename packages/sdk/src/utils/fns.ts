export const isRequired = <T>(value: T): value is NonNullable<T> => {
  return value !== null && value !== undefined;
};
