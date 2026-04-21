import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2, Pencil, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/formatting';
import { notificationTypes } from '@/lib/colors';
import { deleteJson, getJson, patchJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  AdminNotification,
  AdminNotificationSendResponse,
  NotificationTargetAudience,
  User,
} from '@/types';

const TARGET_LABELS: Record<string, string> = {
  all_customers: 'All customers',
  all_delivery_boys: 'All delivery partners',
  all_users: 'All users (legacy)',
  direct: 'Direct recipients',
};

function audienceLabelForNotification(n: AdminNotification): string {
  const ta = n.target_audience;
  const seg =
    n.data && typeof n.data === 'object' && 'segment' in n.data
      ? (n.data as { segment?: string }).segment
      : undefined;
  if (ta === 'direct' && seg === 'customers') return 'Selected customers';
  if (ta === 'direct' && seg === 'delivery_boys') return 'Selected delivery partners';
  if (ta && TARGET_LABELS[ta]) return TARGET_LABELS[ta];
  return ta ?? '—';
}

const MEDIUM_LABELS: Record<string, string> = {
  sms: 'SMS',
  push_notification: 'Push',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'sent':
      return 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200';
    case 'failed':
      return 'bg-destructive/15 text-destructive';
    case 'skipped':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AdminNotifications() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: 'send' | 'history' = tabParam === 'history' ? 'history' : 'send';

  const setTab = (next: 'send' | 'history') => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'send') nextParams.delete('tab');
    else nextParams.set('tab', 'history');
    setSearchParams(nextParams, { replace: true });
  };

  const [form, setForm] = useState({
    type: 'promo',
    title: '',
    body: '',
    medium: 'push_notification' as 'push_notification' | 'sms',
  });

  const [audienceGroup, setAudienceGroup] = useState<'customers' | 'delivery_partners'>('customers');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');

  const [detailId, setDetailId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminNotification | null>(null);
  const [editForm, setEditForm] = useState({
    type: 'promo',
    title: '',
    body: '',
    medium: 'push_notification' as 'push_notification' | 'sms',
    target_audience: 'all_customers' as NotificationTargetAudience,
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['admin-notifications', token],
    queryFn: () => getJson<AdminNotification[]>('/api/admin/notifications/', token),
    enabled: !!token,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-notification-detail', detailId, token],
    queryFn: () => getJson<AdminNotification>(`/api/admin/notifications/${detailId}/`, token),
    enabled: !!token && detailId != null,
  });

  const { data: pickCustomers = [] } = useQuery({
    queryKey: ['admin-users', 'customers', token],
    queryFn: () => getJson<User[]>(`/api/admin/users/?role=customers`, token),
    enabled: !!token && activeTab === 'send' && audienceGroup === 'customers' && scope === 'selected',
  });

  const { data: pickDeliveryPartners = [] } = useQuery({
    queryKey: ['admin-users', 'delivery-boys', token],
    queryFn: () => getJson<User[]>(`/api/admin/users/?role=delivery-boys`, token),
    enabled: !!token && activeTab === 'send' && audienceGroup === 'delivery_partners' && scope === 'selected',
  });

  const pickerUsers = audienceGroup === 'customers' ? pickCustomers : pickDeliveryPartners;
  const filteredPickerUsers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pickerUsers;
    return pickerUsers.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        String(u.id).includes(q),
    );
  }, [pickerUsers, pickerQuery]);

  const sendMut = useMutation({
    mutationFn: () => {
      const target = audienceGroup === 'customers' ? 'all_customers' : 'all_delivery_boys';
      const payload: {
        type: string;
        title: string;
        body: string;
        medium: 'push_notification' | 'sms';
        target: 'all_customers' | 'all_delivery_boys';
        recipient_ids?: number[];
      } = {
        type: form.type,
        title: form.title.trim(),
        body: form.body.trim(),
        medium: form.medium,
        target,
      };
      if (scope === 'selected') {
        payload.recipient_ids = selectedUserIds;
      }
      return postJson<AdminNotificationSendResponse, typeof payload>(
        '/api/admin/notifications/send/',
        payload,
        token,
      );
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      const d = data.delivery;
      if (d) {
        toast.success(
          `Delivered: ${d.sent} sent, ${d.failed} failed, ${d.skipped} skipped (${data.recipients_total ?? 0} recipients).`,
        );
      } else {
        toast.success('Notification saved and processed.');
      }
      setTab('history');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send notification.');
    },
  });

  const updateMut = useMutation({
    mutationFn: () =>
      patchJson<AdminNotification, typeof editForm>(
        `/api/admin/notifications/${editing!.id}/`,
        {
          type: editForm.type,
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          medium: editForm.medium,
          target_audience: editForm.target_audience,
        },
        token,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notification-detail'] });
      setEditing(null);
      toast.success('Notification updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update notification.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/admin/notifications/${id}/`, token),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notification-detail'] });
      setDeleteTarget(null);
      setDetailId(prev => (prev === deletedId ? null : prev));
      toast.success('Notification deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete notification.');
    },
  });

  const openEdit = (n: AdminNotification) => {
    setEditing(n);
    setEditForm({
      type: n.type,
      title: n.title,
      body: n.body,
      medium: n.medium,
      target_audience: (n.target_audience ?? 'all_customers') as NotificationTargetAudience,
    });
  };

  if (!token) {
    return <div className="p-8 text-muted-foreground">Staff only.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('send')}
          className={`px-4 py-2 text-sm rounded-lg font-medium ${
            activeTab === 'send' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Send New
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm rounded-lg font-medium ${
            activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'send' ? (
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-2xl font-display font-bold">Send Notification</h1>
          <p className="text-sm text-muted-foreground">
            Messages are delivered immediately via the selected channel. Push uses Firebase (FCM); SMS uses your
            configured provider (e.g. Twilio).
          </p>
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-border rounded-lg p-3 text-sm bg-background"
              >
                {notificationTypes.map(t => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                placeholder="Short headline"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Message *</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={4}
                className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                placeholder="Full message body"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Medium</label>
              <select
                value={form.medium}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    medium: e.target.value as 'push_notification' | 'sms',
                  }))
                }
                className="w-full border border-border rounded-lg p-3 text-sm bg-background"
              >
                <option value="push_notification">Push notification (FCM)</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Target audience</label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Recipients</label>
                  <select
                    value={audienceGroup}
                    onChange={e => {
                      setAudienceGroup(e.target.value as 'customers' | 'delivery_partners');
                      setSelectedUserIds([]);
                      setPickerQuery('');
                    }}
                    className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                  >
                    <option value="customers">Customers</option>
                    <option value="delivery_partners">Delivery partners</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Send to</label>
                  <select
                    value={scope}
                    onChange={e => {
                      const v = e.target.value as 'all' | 'selected';
                      setScope(v);
                      if (v === 'all') setSelectedUserIds([]);
                      setPickerQuery('');
                    }}
                    className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                  >
                    <option value="all">
                      {audienceGroup === 'customers' ? 'All customers' : 'All delivery partners'}
                    </option>
                    <option value="selected">
                      {audienceGroup === 'customers'
                        ? 'Selected customers only'
                        : 'Selected delivery partners only'}
                    </option>
                  </select>
                </div>
                {scope === 'selected' && (
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                    <label className="text-xs font-medium">Choose recipients</label>
                    <input
                      type="search"
                      value={pickerQuery}
                      onChange={e => setPickerQuery(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setSelectedUserIds(filteredPickerUsers.map(u => u.id))}
                      >
                        Select all in list
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => setSelectedUserIds([])}
                      >
                        Clear
                      </button>
                    </div>
                    <ScrollArea className="h-[200px] pr-3">
                      {filteredPickerUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4">No users match.</p>
                      ) : (
                        <ul className="space-y-2">
                          {filteredPickerUsers.map(u => (
                            <li key={u.id} className="flex items-start gap-2 text-sm">
                              <Checkbox
                                id={`notify-pick-${u.id}`}
                                checked={selectedUserIds.includes(u.id)}
                                onCheckedChange={checked => {
                                  const on = checked === true;
                                  setSelectedUserIds(prev =>
                                    on
                                      ? prev.includes(u.id)
                                        ? prev
                                        : [...prev, u.id]
                                      : prev.filter(x => x !== u.id),
                                  );
                                }}
                              />
                              <label
                                htmlFor={`notify-pick-${u.id}`}
                                className="cursor-pointer leading-tight"
                              >
                                <span className="font-medium">{u.name}</span>
                                <span className="block text-xs text-muted-foreground font-mono">
                                  {u.phone}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">{selectedUserIds.length} selected</p>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => sendMut.mutate()}
              disabled={
                sendMut.isPending ||
                !form.title.trim() ||
                !form.body.trim() ||
                (scope === 'selected' && selectedUserIds.length === 0)
              }
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send size={16} /> Send now
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-display font-bold">Notification History</h1>
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          <div className="bg-card rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[1020px]">
              <thead>
                <tr className="bg-muted text-xs uppercase">
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Medium</th>
                  <th className="text-left px-4 py-3">Audience</th>
                  <th className="text-center px-4 py-3">Recipients</th>
                  <th className="text-center px-4 py-3">Delivery</th>
                  <th className="text-left px-4 py-3">Sent</th>
                  <th className="text-right px-4 py-3 w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map(n => (
                  <tr
                    key={n.id}
                    className="border-b border-border hover:bg-muted/40 cursor-pointer"
                    onClick={() => setDetailId(n.id)}
                  >
                    <td className="px-4 py-3">#{n.id}</td>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{n.title}</td>
                    <td className="px-4 py-3 text-xs capitalize">{n.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-normal">
                        {MEDIUM_LABELS[n.medium] ?? n.medium}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{audienceLabelForNotification(n)}</td>
                    <td className="px-4 py-3 text-center">{n.recipients_count ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="text-emerald-700 dark:text-emerald-400">{n.delivery_sent_count ?? 0}</span>
                      {' / '}
                      <span className="text-destructive">{n.delivery_failed_count ?? 0}</span>
                      {' / '}
                      <span className="text-amber-700 dark:text-amber-400">{n.delivery_skipped_count ?? 0}</span>
                      <div className="text-[10px] text-muted-foreground">ok / fail / skip</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(n.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setDetailId(n.id)}
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => openEdit(n)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(n)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-8">No notifications yet.</p>
          )}
        </div>
      )}

      <Dialog open={detailId != null} onOpenChange={open => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification #{detailId}</DialogTitle>
          </DialogHeader>
          {detailLoading && <p className="text-sm text-muted-foreground">Loading details…</p>}
          {!detailLoading && detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Title</span>
                  <p className="font-medium">{detail.title}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sent</span>
                  <p>{formatDateTime(detail.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Medium</span>
                  <p>{MEDIUM_LABELS[detail.medium] ?? detail.medium}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Audience</span>
                  <p>{audienceLabelForNotification(detail)}</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Message</span>
                <p className="mt-1 whitespace-pre-wrap border border-border rounded-md p-3 bg-muted/30">{detail.body}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Sent: {detail.delivery_sent_count ?? 0}</Badge>
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  Failed: {detail.delivery_failed_count ?? 0}
                </Badge>
                <Badge variant="outline">Skipped: {detail.delivery_skipped_count ?? 0}</Badge>
              </div>
              {detail.recipients && detail.recipients.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Recipients (up to 500)</p>
                  <div className="border border-border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-2">User</th>
                          <th className="text-left px-2 py-2">Phone</th>
                          <th className="text-left px-2 py-2">Status</th>
                          <th className="text-left px-2 py-2">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.recipients.map(r => (
                          <tr key={r.user_id} className="border-t border-border">
                            <td className="px-2 py-1.5">{r.user_name}</td>
                            <td className="px-2 py-1.5 font-mono">{r.user_phone}</td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded ${statusBadgeClass(r.delivery_status)}`}
                              >
                                {r.delivery_status}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate" title={r.error_message}>
                              {r.error_message || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editing != null} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit notification #{editing?.id}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Changes update the stored record only; they do not send the message again.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                >
                  {notificationTypes.map(t => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Title</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Message</label>
                <textarea
                  value={editForm.body}
                  onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                  rows={4}
                  className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Medium</label>
                <select
                  value={editForm.medium}
                  onChange={e =>
                    setEditForm(f => ({
                      ...f,
                      medium: e.target.value as 'push_notification' | 'sms',
                    }))
                  }
                  className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                >
                  <option value="push_notification">Push notification (FCM)</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Target audience</label>
                <select
                  value={editForm.target_audience}
                  onChange={e =>
                    setEditForm(f => ({
                      ...f,
                      target_audience: e.target.value as NotificationTargetAudience,
                    }))
                  }
                  className="w-full border border-border rounded-lg p-3 text-sm bg-background"
                >
                  <option value="all_customers">All customers</option>
                  <option value="all_delivery_boys">All delivery partners</option>
                  <option value="all_users">All users (legacy)</option>
                  <option value="direct">Direct recipients</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updateMut.isPending || !editForm.title.trim() || !editForm.body.trim()}
              onClick={() => updateMut.mutate()}
            >
              {updateMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the notification
              {deleteTarget ? ` “${deleteTarget.title.slice(0, 80)}${deleteTarget.title.length > 80 ? '…' : ''}”` : ''}{' '}
              and its delivery records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending || !deleteTarget}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
