import { useAuth } from '@/contexts/AuthContext';

/** React Query queryFns का लागि हालको auth token (logout भए null)। */
export function useToken() {
  return useAuth().token;
}
