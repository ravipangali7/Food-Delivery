import { Navigate, useLocation } from 'react-router-dom';

/** Maps legacy `/admin/users/...` URLs to slug routes (`customers`, `delivery-boys`). */
export function LegacyAdminUsersRedirect() {
  const location = useLocation();
  const tail = location.pathname.slice('/admin/users'.length) || '/';
  const search = location.search;

  if (tail === '/' || tail === '') {
    return <Navigate to={`/admin/customers${search}`} replace />;
  }

  const sp = new URLSearchParams(search);
  if (tail === '/new' && sp.get('role') === 'delivery') {
    return <Navigate to={`/admin/delivery-boys/new${search}`} replace />;
  }

  return <Navigate to={`/admin/customers${tail}${search}`} replace />;
}
