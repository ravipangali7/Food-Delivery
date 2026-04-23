import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { postJson, ApiHttpError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type TestSendResponse = {
  ok: boolean;
  detail: string;
  meta?: Record<string, unknown>;
};

export default function AdminSmsTest() {
  const { token } = useAuth();
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('Test message from admin portal.');

  const mutation = useMutation({
    mutationFn: () =>
      postJson<TestSendResponse, { to: string; message: string }>(
        '/api/admin/sms/test-send/',
        { to: to.trim(), message: message.trim() },
        token,
      ),
    onSuccess: data => {
      if (data.ok) {
        toast.success('SMS sent.', { description: JSON.stringify(data.meta ?? {}) });
      } else {
        toast.error(data.detail || 'Send failed');
      }
    },
    onError: (e: unknown) => {
      if (e instanceof ApiHttpError) {
        const d =
          typeof e.data === 'object' && e.data !== null && 'detail' in e.data
            ? String((e.data as { detail?: unknown }).detail)
            : e.message;
        toast.error(d || 'Request failed');
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Request failed');
    },
  });

  const remaining = 160 - message.length;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Test SMS</h1>
        <p className="text-sm text-stone-600 mt-1">
          Sends one SMS via Infelo using the server{' '}
          <code className="text-xs bg-stone-100 px-1 rounded">INFELO_SMS_API_KEY</code> (Bearer{' '}
          <code className="text-xs bg-stone-100 px-1 rounded">POST /api/v1/sms/send/</code>). Each successful send
          consumes one credit.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sms-to">To (Nepal mobile or E.164)</Label>
          <Input
            id="sms-to"
            placeholder="+9779841112233 or 9841112233"
            value={to}
            onChange={e => setTo(e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="sms-msg">Message</Label>
            <span className={`text-xs ${remaining < 0 ? 'text-red-600' : 'text-stone-500'}`}>
              {remaining} left
            </span>
          </div>
          <Textarea
            id="sms-msg"
            rows={4}
            maxLength={160}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <Button
          type="button"
          disabled={mutation.isPending || !to.trim() || !message.trim()}
          onClick={() => mutation.mutate()}
          className="gap-2"
        >
          <Send size={16} />
          {mutation.isPending ? 'Sending…' : 'Send test SMS'}
        </Button>
      </div>
    </div>
  );
}
