import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import { patchFormData, patchJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LocationMiniMap from '@/components/maps/LocationMiniMap';
import type { User } from '@/types';

function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e8) / 1e8;
  return String(rounded);
}

/** Only allow in-app relative paths under /customer/ */
function safeCustomerReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  if (!raw.startsWith('/customer/')) return null;
  if (raw.includes('//') || raw.includes('..')) return null;
  return raw;
}

export default function CustomerEditProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeCustomerReturnPath(searchParams.get('returnTo'));

  const { token, user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setEmail(user.email ?? '');
    setProfilePhotoUrl(user.profile_photo ?? '');
    setPhotoFile(null);
    setPreviewUrl(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setAddress(user.address?.trim() ?? '');
    if (user.latitude != null && user.longitude != null) {
      setLatitude(formatCoord(Number(user.latitude)));
      setLongitude(formatCoord(Number(user.longitude)));
    } else {
      setLatitude('');
      setLongitude('');
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onPickPhoto = (file: File | null) => {
    setPhotoFile(file);
    setPreviewUrl(prev => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      if (file) {
        return URL.createObjectURL(file);
      }
      return null;
    });
  };

  const onCoordinatesChange = useCallback((lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const buildCoordPayload = useCallback(() => {
    const lat = Number.parseFloat(latitude.trim());
    const lng = Number.parseFloat(longitude.trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng } as const;
    }
    return { latitude: null, longitude: null } as const;
  }, [latitude, longitude]);

  const save = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not signed in');
      const coords = buildCoordPayload();

      if (photoFile) {
        if (coords.latitude == null) {
          await patchJson<User, Record<string, unknown>>(
            '/api/auth/me/',
            { latitude: null, longitude: null },
            token,
          );
        }
        const fd = new FormData();
        fd.append('name', name.trim());
        const em = email.trim();
        if (em) fd.append('email', em);
        fd.append('address', address.trim());
        if (coords.latitude != null && coords.longitude != null) {
          fd.append('latitude', String(coords.latitude));
          fd.append('longitude', String(coords.longitude));
        }
        fd.append('profile_photo_file', photoFile);
        return patchFormData<User>('/api/auth/me/', fd, token);
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim(),
      };
      const em = email.trim();
      if (em) body.email = em;
      if (coords.latitude != null && coords.longitude != null) {
        body.latitude = coords.latitude;
        body.longitude = coords.longitude;
      } else {
        body.latitude = null;
        body.longitude = null;
      }
      return patchJson<User, Record<string, unknown>>('/api/auth/me/', body, token);
    },
    onSuccess: async () => {
      setError(null);
      setPhotoFile(null);
      setPreviewUrl(prev => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      const me = await refreshUser();
      if (me?.profile_photo) {
        setProfilePhotoUrl(me.profile_photo);
      } else {
        setProfilePhotoUrl('');
      }
      if (returnTo) {
        navigate(returnTo, { replace: true });
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const displayAvatar = previewUrl || profilePhotoUrl || '';
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  if (!token || !user) {
    return (
      <div className="p-8 text-center">
        <Link to="/login" className="text-amber-600">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Edit Profile</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {returnTo ? (
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Set your delivery location on the map below, then save — you will return to checkout.
          </div>
        ) : null}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="block text-sm font-semibold">Profile photo (optional)</label>
          <p className="text-[11px] text-muted-foreground">Choose an image from your device — no URL needed.</p>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden bg-amber-100 border border-border flex items-center justify-center">
              {displayAvatar ? (
                <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-amber-800">{initial}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={e => onPickPhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted/50"
              >
                <Camera size={18} />
                {photoFile ? 'Change photo' : 'Choose photo'}
              </button>
              {photoFile ? (
                <button
                  type="button"
                  onClick={() => onPickPhoto(null)}
                  className="text-xs text-red-600 text-left hover:underline"
                >
                  Remove new selection
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="block text-sm font-semibold">Full name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="block text-sm font-semibold">Phone</label>
          <input
            value={user.phone}
            disabled
            className="w-full border border-border rounded-xl p-3 text-sm bg-muted/50 text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground">Phone is your login ID and cannot be changed here.</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="block text-sm font-semibold">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            autoComplete="email"
          />
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Default address &amp; map pin</h3>
          <p className="text-xs text-muted-foreground">
            Your saved pin is used as the default drop-off at checkout. You can move it here anytime, or adjust it on the
            checkout screen before each order.
          </p>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            placeholder="Street, area, landmark…"
          />
          <div className="pt-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Map pin</h4>
            <LocationMiniMap
              latitude={latitude}
              longitude={longitude}
              onCoordinatesChange={onCoordinatesChange}
              mapHeightClassName="h-[200px] min-h-[180px]"
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-card border-t border-border z-30">
        <button
          type="button"
          disabled={!name.trim() || save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          className="block w-full py-3.5 bg-amber-500 text-white text-center font-semibold rounded-full text-sm hover:bg-amber-600 disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
