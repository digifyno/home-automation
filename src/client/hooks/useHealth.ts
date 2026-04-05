import { useQuery } from '@tanstack/react-query';

interface HealthStatus {
  status: 'ok' | 'degraded';
  fibaro: 'reachable' | 'unreachable';
}

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 30000,
    retry: false,
  });
}
