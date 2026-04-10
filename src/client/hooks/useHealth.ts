import { useQuery } from '@tanstack/react-query';

interface HealthStatus {
  status: 'ok' | 'degraded';
  fibaro: 'reachable' | 'unreachable';
}

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () =>
      fetch('/api/health').then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HealthStatus>;
      }),
    refetchInterval: 30000,
    retry: false,
  });
}
