import { useMutation } from '@tanstack/react-query';
import { getRegistryApp } from '../crud/registry.ts';
import { useSDK } from './store.tsx';

export const useGetRegistryApp = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: (params: { name: string }) => getRegistryApp(workspace, params),
  });
};
