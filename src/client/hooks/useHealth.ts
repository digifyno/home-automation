import { useQuery } from '@tanstack/react-query';

interface HealthStatus {
  status: 'ok' | 'degraded';
  fibaro: 'reachable' | 'unreachable';
}

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: async () => {
      const r = await fetch('/api/health');
      const data = await r.json() as HealthStatus;
      return data;
    },
    refetchInterval: 30000,
    retry: false,
  });
}
