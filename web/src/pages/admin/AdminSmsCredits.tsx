import { Navigate } from 'react-router-dom';

/** @deprecated — use /admin/infelo/sms */
export default function AdminSmsCredits() {
  return <Navigate to="/admin/infelo/sms" replace />;
}
