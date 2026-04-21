import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CustomerPrivacy() {
  return (
    <div className="pb-8">
      <div className="sticky top-0 bg-card z-40 px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/customer/profile" className="p-1">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Privacy policy</h1>
      </div>

      <div className="px-4 py-6 space-y-5 text-sm text-muted-foreground leading-relaxed max-w-prose mx-auto">
        <p>
          We collect and use personal data only as needed to run this service. This matches the fields stored on your
          user profile and orders in our application.
        </p>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Account data</h2>
          <p>
            Your account includes your phone number (used to sign in), name, optional email, optional profile photo
            URL, and optional default address with coordinates if you save them. We also store an optional device
            notification token for push messages.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Orders</h2>
          <p>
            Each order stores delivery address text, optional latitude and longitude for routing, special instructions,
            payment method (cash on delivery), delivery type, amounts, and status history. This data is used to fulfil
            your order and coordinate with delivery partners.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Notifications</h2>
          <p>
            We may send order-related notifications (for example when status changes) using the channels configured in the
            system, such as SMS or push, in line with notification records tied to your user account.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Retention</h2>
          <p>
            We retain order and account data as required for operations, support, and legal compliance. Soft-deleted
            accounts may be marked inactive rather than erased immediately, consistent with our user model.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground text-base mb-2">Your choices</h2>
          <p>
            You can update profile details in the app where editing is available. For questions about your data, contact
            support through the store contact options shown in the app.
          </p>
        </section>
      </div>
    </div>
  );
}
