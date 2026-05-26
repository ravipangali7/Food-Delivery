import {
  formatCurrency,
  formatDateTime,
  num,
  orderPaymentStatusLabel,
  unitLabel,
} from '@/lib/formatting';
import type { OrderInvoiceImageMap, OrderInvoiceStore } from '@/lib/orderInvoice';
import type { Order, OrderItem } from '@/types';

const INVOICE_WIDTH_PX = 794;

function itemThumbSrc(item: OrderItem, images: OrderInvoiceImageMap): string | undefined {
  const embedded = images.items[item.id];
  if (embedded) return embedded;
  const url = item.product?.thumbnail_url || item.product?.images?.[0]?.image_url;
  return url || undefined;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function OrderInvoiceContent({
  order,
  store,
  images,
  className,
}: {
  order: Order;
  store: OrderInvoiceStore;
  images: OrderInvoiceImageMap;
  className?: string;
}) {
  const items = order.items ?? [];
  const platformFee = num(order.platform_fee_amount);

  return (
    <div
      className={className}
      data-order-invoice-root
      style={{
        width: INVOICE_WIDTH_PX,
        maxWidth: '100%',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: '#1c1917',
        background: '#fff',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: '32px 36px 28px',
          borderBottom: '3px solid #d97706',
          background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 55%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                overflow: 'hidden',
                border: '2px solid #fde68a',
                background: '#fff',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {images.logo || store.logoUrl ? (
                <img
                  src={images.logo || store.logoUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 28 }}>🍬</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#78350f',
                  lineHeight: 1.2,
                }}
              >
                {store.name}
              </h1>
              {store.address && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#57534e', lineHeight: 1.45 }}>{store.address}</p>
              )}
              {store.phone && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#57534e' }}>Tel: {store.phone}</p>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#b45309',
              }}
            >
              Tax Invoice
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#1c1917' }}>{order.order_number}</div>
            <div style={{ fontSize: 12, color: '#78716c', marginTop: 6 }}>{formatDateTime(order.created_at)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 36px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: '#fafaf9',
            border: '1px solid #e7e5e4',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8a29e' }}>
            Bill to
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{order.customer?.name || 'Guest'}</div>
          {order.customer?.phone && (
            <div style={{ fontSize: 12, color: '#57534e', marginTop: 4 }}>{order.customer.phone}</div>
          )}
          <div style={{ fontSize: 11, color: '#78716c', marginTop: 10, lineHeight: 1.5 }}>{order.address}</div>
        </div>
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: '#fafaf9',
            border: '1px solid #e7e5e4',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8a29e' }}>
            Order details
          </div>
          <table style={{ width: '100%', marginTop: 8, fontSize: 12, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0', color: '#78716c' }}>Status</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{statusLabel(order.status)}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#78716c' }}>Payment</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>
                  Cash on delivery — {orderPaymentStatusLabel(order.payment_status)}
                </td>
              </tr>
              {order.delivery_boy?.name && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#78716c' }}>Delivery</td>
                  <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{order.delivery_boy.name}</td>
                </tr>
              )}
              {order.is_preorder && order.pre_order_date_time && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#78716c' }}>Pre-order</td>
                  <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatDateTime(order.pre_order_date_time)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: '20px 36px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#292524', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '8px 0 0 0', fontWeight: 600 }}>
                Item
              </th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600, width: 56 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, width: 96 }}>Rate</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', borderRadius: '0 8px 0 0', fontWeight: 600, width: 104 }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const thumb = itemThumbSrc(item, images);
              return (
                <tr
                  key={item.id}
                  style={{
                    background: idx % 2 === 0 ? '#fff' : '#fafaf9',
                    borderBottom: '1px solid #f5f5f4',
                  }}
                >
                  <td style={{ padding: '12px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          flexShrink: 0,
                        }}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 20,
                            }}
                          >
                            🍬
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1c1917' }}>{item.product?.name || 'Product'}</div>
                        {item.product && (
                          <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{unitLabel(item.product)}</div>
                        )}
                        {item.notes && (
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, fontStyle: 'italic' }}>
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', verticalAlign: 'top' }}>
                    {formatCurrency(num(item.unit_price))}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, verticalAlign: 'top' }}>
                    {formatCurrency(num(item.total_price))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '16px 36px 32px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#57534e' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(num(order.subtotal))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#57534e' }}>
            <span>Delivery fee</span>
            <span>{formatCurrency(num(order.delivery_fee))}</span>
          </div>
          {platformFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#57534e' }}>
              <span>Service fee</span>
              <span>{formatCurrency(platformFee)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              marginTop: 8,
              borderRadius: 10,
              background: 'linear-gradient(90deg, #d97706, #b45309)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            <span>Total (NPR)</span>
            <span>{formatCurrency(num(order.total_amount))}</span>
          </div>
        </div>
      </div>

      {order.special_instructions && (
        <div style={{ margin: '0 36px 20px', padding: '12px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#b45309' }}>Special instructions</div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>{order.special_instructions}</p>
        </div>
      )}

      <div
        style={{
          padding: '16px 36px 28px',
          borderTop: '1px solid #e7e5e4',
          textAlign: 'center',
          fontSize: 11,
          color: '#a8a29e',
        }}
      >
        Thank you for your order. This is a computer-generated invoice.
      </div>
    </div>
  );
}
