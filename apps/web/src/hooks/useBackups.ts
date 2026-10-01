import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const BACKUPS_KEY = ['backups'];

/** Lista de respaldos de la BD local (solo ADMIN). */
export function useBackups() {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => api.getBackups(),
  });
}

/** Crea un respaldo inmediato y refresca la lista. */
export function useCrearBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.crearBackup(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}
