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
      // Intentionally skip r.ok check: /api/health always returns JSON (even on 503),
      // so we read the body regardless of status to surface the 'degraded' state.
      const data = await r.json() as HealthStatus;
      return data;
    },
    refetchInterval: 30000,
    retry: false,
  });
}
