import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useLocalStorage<T>(
  { key, defaultValue, serializer = JSON.stringify, deserializer = JSON.parse }: {
    key: string;
    defaultValue: T;
    serializer?: (value: T) => string;
    deserializer?: (value: string) => T;
  },
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["use-local-storage", key],
    queryFn: () => {
      const item = localStorage.getItem(key);
      return item ? deserializer(item) : defaultValue;
    },
    initialData: defaultValue,
  });

  const update = (value: T) => {
    localStorage.setItem(key, serializer(value));
    queryClient.setQueryData(["use-local-storage", key], value);
  };

  const patch = (value: Partial<T>) => {
    const currentValue = query.data as T;
    const updatedValue = { ...currentValue, ...value };
    update(updatedValue);
  };

  return {
    value: query.data ?? defaultValue,
    update,
    patch,
  };
}
