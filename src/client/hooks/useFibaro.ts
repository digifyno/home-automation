import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.ts';

export function useRooms() {
  return useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
}

export function useDevices() {
  return useQuery({ queryKey: ['devices'], queryFn: api.getDevices, refetchInterval: 30000 });
}

export function useScenes() {
  return useQuery({ queryKey: ['scenes'], queryFn: api.getScenes, refetchInterval: 60000 });
}

export function useWeather() {
  return useQuery({ queryKey: ['weather'], queryFn: api.getWeather, refetchInterval: 60000 });
}

export function useEnergy() {
  return useQuery({ queryKey: ['energy'], queryFn: api.getEnergy, refetchInterval: 30000 });
}

export function useDeviceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, args }: { id: number; action: string; args?: unknown }) =>
      api.deviceAction(id, action, args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useSceneExecute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.executeScene(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scenes'] });
    },
  });
}
