import { useQuery, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY_LOCAL_STORAGE = "use-local-storage";

interface UseLocalStorageSetterProps<T> {
  key: string;
  serializer?: (value: T) => string;
  onUpdate?: (value: T) => void;
}

export function useLocalStorageSetter<T>(
  {
    key,
    serializer = JSON.stringify,
    onUpdate,
  }: UseLocalStorageSetterProps<T>,
) {
  const queryClient = useQueryClient();

  const update = (value: T) => {  
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, serializer(value));
    }

    queryClient.setQueryData([QUERY_KEY_LOCAL_STORAGE, key], value);
    onUpdate?.(value);
  };

  const patch = (value: Partial<T>) => {
    const currentValue = queryClient.getQueryData<T>([QUERY_KEY_LOCAL_STORAGE, key]) as T;
    const updatedValue = { ...currentValue, ...value };
    update(updatedValue);
  };

  return { update, patch };
}

interface UseLocalStorageProps<T, R = T> extends UseLocalStorageSetterProps<T> {
  defaultValue: T;
  deserializer?: (value: string) => T;
  select?: (data: T) => R;
}

export function useLocalStorage<T, R = T>({
  key,
  defaultValue,
  serializer = JSON.stringify,
  deserializer = JSON.parse,
  onUpdate,
  select,
  }: UseLocalStorageProps<T, R>,
) {
  const query = useQuery({
    queryKey: [QUERY_KEY_LOCAL_STORAGE, key],
    queryFn: () => {
      const item = localStorage.getItem(key);
      return item ? deserializer(item) : defaultValue;
    },
    select,
    initialData: defaultValue,
  });

  const { update, patch } = useLocalStorageSetter({ key, serializer, onUpdate });

  return {
    value: query.data ?? defaultValue,
    update,
    patch,
  };
}
