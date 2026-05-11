import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../hooks/useSubscription';

/**
 * Top-of-page banner that communicates subscription state.
 *
 * States:
 * - No profile loaded yet              → hidden (avoids flashing wrong copy)
 * - Subscription columns missing       → hidden (defensive: don't shout at users
 *                                        before the launch migration is applied)
 * - Active paid subscriber             → hidden (no upsell needed)
 * - Currently in 30-day trial          → countdown ("Te quedan X días…")
 * - Last 5 days of trial               → urgent variant (orange CTA)
 * - Trial ended / subscription expired → "Tu mes gratis ha terminado…"
 * - Plain free user (never had Social) → soft upsell ("Descubre PetPanic Social")
 */
export default function TrialBanner() {
  const navigate = useNavigate();
  const { userProfile } = useApp();
  const { isTrialing, isActivePaid, daysLeftInTrial, hasActiveSocial, status } =
    useSubscription();

  // No profile loaded yet → render nothing (prevents banner flicker on app boot
  // and avoids showing "expired" copy before the real subscription state arrives).
  if (!userProfile) return null;

  // Defensive: if the subscription columns aren't populated at all, treat the
  // account as "pre-launch / unknown" and stay silent. This prevents every user
  // from seeing the dark "Tu mes gratis ha terminado" banner if the Supabase
  // migration hasn't been applied yet.
  if (!userProfile.subscription_status) return null;

  // Paid subscriber: nothing to show.
  if (isActivePaid) return null;

  // Active trial: countdown banner. Last 5 days flips to urgent variant.
  if (isTrialing) {
    const urgent = daysLeftInTrial <= 5;
    return (
      <button
        onClick={() => navigate('/plan')}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium transition-colors ${
          urgent
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-gradient-to-r from-orange-50 to-yellow-50 text-stone-900 hover:from-orange-100 hover:to-yellow-100 border-b border-orange-200'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sparkles
            className={`w-4 h-4 flex-shrink-0 ${urgent ? 'text-white' : 'text-orange-500'}`}
          />
          <span className="truncate">
            {urgent
              ? `¡Solo te quedan ${daysLeftInTrial} ${daysLeftInTrial === 1 ? 'día' : 'días'} de Social!`
              : `Te quedan ${daysLeftInTrial} días de PetPanic Social gratis`}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
      </button>
    );
  }

  // Anything below this point implies hasActiveSocial === false.

  // Trial used up or subscription cancelled → strong "expired" banner.
  if (status === 'expired' || status === 'canceled') {
    return (
      <button
        onClick={() => navigate('/plan')}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-orange-300" />
          <span className="truncate">Tu mes gratis ha terminado — activa Social</span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
      </button>
    );
  }

  // Plain free user that never opted into Social → soft upsell.
  // Only show if they don't already have Social available right now.
  if (!hasActiveSocial) {
    return (
      <button
        onClick={() => navigate('/plan')}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium bg-gradient-to-r from-orange-50 to-yellow-50 text-stone-900 hover:from-orange-100 hover:to-yellow-100 border-b border-orange-200 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-orange-500" />
          <span className="truncate">Descubre PetPanic Social — 30 días gratis</span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
      </button>
    );
  }

  return null;
}
