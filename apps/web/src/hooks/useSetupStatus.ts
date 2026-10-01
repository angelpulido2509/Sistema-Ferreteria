import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const SETUP_STATUS_KEY = ['auth', 'setup-status'];

/** Indica si el sistema aún no tiene ningún ADMIN (asistente de primer arranque). */
export function useSetupStatus(enabled: boolean) {
  return useQuery({
    queryKey: SETUP_STATUS_KEY,
    queryFn: () => api.getSetupStatus(),
    enabled,
    staleTime: Infinity,
  });
}

/** Crea el primer ADMIN y refresca el estado del asistente. */
export function useSetupInicial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; email: string; password: string }) => api.setupInicial(data),
    onSuccess: () => {
      queryClient.setQueryData(SETUP_STATUS_KEY, { needsSetup: false });
    },
  });
}
