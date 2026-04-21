import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Phone, ShieldCheck } from 'lucide-react';
import { postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';
import { homeForUser } from '@/pages/auth/authPaths';

type TokenResponse = { token: string; user: User };
type OtpSendResponse = { detail?: string; existing_user_name?: string; otp_code?: string };
type Purpose = 'login' | 'register';

type Props = {
  mode: Purpose;
  title: string;
  subtitle: string;
  alternateHint: string;
  alternateLabel: string;
  alternateTo: string;
};

export default function PhoneOtpAuth({
  mode,
  title,
  subtitle,
  alternateHint,
  alternateLabel,
  alternateTo,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  const [name, setName] = useState('');
  /** Login only: if this phone is new, we send name on verify to create the account. */
  const [nameForNewLogin, setNameForNewLogin] = useState('');
  /** Set when backend already has a name for this phone — field is read-only. */
  const [nameLockedFromBackend, setNameLockedFromBackend] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const purpose: Purpose = mode;
  const phoneDigits = phone.replace(/\D/g, '').slice(0, 15);
  const canSend =
    phoneDigits.length >= 7 &&
    (mode === 'login' || name.trim().length >= 2);

  const handleSendOtp = async () => {
    if (!canSend) return;
    setError(null);
    setLoading(true);
    try {
      const sendRes = await postJson<OtpSendResponse, { phone: string; purpose: Purpose }>(
        '/api/auth/otp/send/',
        { phone: phoneDigits, purpose },
        null,
      );
      setStep('otp');
      setOtp('');
      if (mode === 'login') {
        const locked = (sendRes.existing_user_name ?? '').trim();
        if (locked) {
          setNameForNewLogin(locked);
          setNameLockedFromBackend(true);
        } else {
          setNameForNewLogin('');
          setNameLockedFromBackend(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.trim().length < 4) return;
    setError(null);
    setLoading(true);
    try {
      const body: { phone: string; purpose: Purpose; otp: string; name?: string } = {
        phone: phoneDigits,
        purpose,
        otp: otp.trim(),
      };
      if (mode === 'register') {
        body.name = name.trim();
      } else if (nameForNewLogin.trim().length >= 2) {
        body.name = nameForNewLogin.trim();
      }

      const res = await postJson<TokenResponse, typeof body>('/api/auth/otp/verify/', body, null);
      setSession(res.token, res.user);
      navigate(from && from !== '/login' && from !== '/register' ? from : homeForUser(res.user), {
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('phone');
    setOtp('');
    setError(null);
    setNameForNewLogin('');
    setNameLockedFromBackend(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 px-4">
      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <span className="text-5xl">🍬</span>
          <h1 className="text-2xl font-display font-bold text-foreground mt-3">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        {step === 'phone' ? (
          <>
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full name</label>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  className="pl-10 h-12 text-base"
                  autoComplete="tel"
                />
              </div>
            </div>

            <Button
              onClick={handleSendOtp}
              disabled={!canSend || loading}
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-amber-600"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending code…
                </span>
              ) : (
                'Send verification code'
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-foreground">OTP verification</p>
              <p className="text-sm text-muted-foreground">
                Enter the code sent to <span className="font-medium text-foreground">{phoneDigits}</span>
              </p>
            </div>
            {mode === 'login' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full name (if you are new)</label>
                <Input
                  type="text"
                  placeholder="Add here if verification asked for your name"
                  value={nameForNewLogin}
                  onChange={e => {
                    if (nameLockedFromBackend) return;
                    setNameForNewLogin(e.target.value);
                  }}
                  readOnly={nameLockedFromBackend}
                  className={
                    nameLockedFromBackend
                      ? 'h-12 text-base cursor-default bg-muted text-foreground'
                      : 'h-12 text-base'
                  }
                  autoComplete="name"
                />
                {nameLockedFromBackend && (
                  <p className="text-xs text-muted-foreground">Name on file for this number — cannot be changed here.</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">One-time code</label>
              <div className="relative">
                <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="pl-10 h-12 text-base tracking-widest font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                />
              </div>
            </div>

            <Button
              onClick={handleVerify}
              disabled={otp.trim().length < 4 || loading}
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-amber-600"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                'Verify and continue'
              )}
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={goBack} disabled={loading}>
                Change number
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={handleSendOtp} disabled={loading}>
                Resend code
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {alternateHint}{' '}
          <Link to={alternateTo} className="text-primary font-medium hover:underline">
            {alternateLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
