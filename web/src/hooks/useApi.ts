import { useAuth } from '@/contexts/AuthContext';

/** Current auth token for React Query queryFns (null if logged out). */
export function useToken() {
  return useAuth().token;
}
