import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';
import { deleteJson, getJson, postJson } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LocationMiniMap from '@/components/maps/LocationMiniMap';
import type { CustomerAddress } from '@/types';

export default function CustomerSavedAddresses() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const onCoordinatesChange = useCallback((lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const { data: list, isLoading } = useQuery({
    queryKey: ['savedAddresses', token],
    queryFn: () => getJson<CustomerAddress[]>('/api/addresses/', token),
    enabled: !!token,
  });

  const add = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('Not signed in');
      const body: Record<string, unknown> = {
        label: label.trim(),
        address: address.trim(),
      };
      const lat = Number.parseFloat(latitude.trim());
      const lng = Number.parseFloat(longitude.trim());
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        body.latitude = lat;
        body.longitude = lng;
      }
      return postJson<CustomerAddress, Record<string, unknown>>('/api/addresses/', body, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedAddresses', token] });
      setLabel('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setFormOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('Not signed in');
      return deleteJson(`/api/addresses/${id}/`, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedAddresses', token] }),
  });

  if (!token) {
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
        <h1 className="font-display font-bold text-lg">Saved addresses</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          <p className="text-center text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            {list?.length ? (
              list.map(row => (
                <div
                  key={row.id}
                  className="bg-card rounded-xl border border-border p-4 flex gap-3 items-start"
                >
                  <MapPin className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{row.label || 'Saved address'}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{row.address}</p>
                    {row.latitude != null && row.longitude != null && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Pin: {String(row.latitude)}, {String(row.longitude)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    aria-label="Delete address"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No saved addresses yet. Add one to reuse at checkout.
              </p>
            )}
          </div>
        )}

        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-800 font-medium text-sm"
          >
            + Add address
          </button>
        ) : (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">New address</h3>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (e.g. Home, Office)"
              className="w-full border border-border rounded-xl p-3 text-sm"
            />
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
              placeholder="Full address"
              className="w-full border border-border rounded-xl p-3 text-sm"
            />
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Drop-off pin (optional)</p>
              <LocationMiniMap
                latitude={latitude}
                longitude={longitude}
                onCoordinatesChange={onCoordinatesChange}
                mapHeightClassName="h-[180px] min-h-[160px]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!address.trim() || add.isPending}
                onClick={() => add.mutate()}
                className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
