import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { getJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type UnreadResponse = { count: number };

export default function NotificationBellLink({ to }: { to: string }) {
  const { token } = useAuth();

  const { data } = useQuery({
    queryKey: ['notifications-unread', token],
    queryFn: () => getJson<UnreadResponse>('/api/notifications/unread-count/', token),
    enabled: !!token,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const count = data?.count ?? 0;
  const label = count > 99 ? '99+' : String(count);

  return (
    <Link to={to} className="relative p-2">
      <Bell size={20} />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {label}
        </span>
      ) : null}
    </Link>
  );
}
