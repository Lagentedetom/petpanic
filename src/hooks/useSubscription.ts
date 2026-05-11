import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { SubscriptionStatus, SubscriptionTier, SubscriptionInterval } from '../types';

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  /** True if user can use Social features right now (trial OR active paid). */
  hasActiveSocial: boolean;
  /** True while user is in the 15-day trial. */
  isTrialing: boolean;
  /** True when subscription is paid and active. */
  isActivePaid: boolean;
  /** Days remaining in the trial (ceil, never negative). 0 if not trialing. */
  daysLeftInTrial: number;
  /** ISO timestamp when trial ends. */
  trialEndsAt: string | null;
  /** Billing interval of the active subscription, when paid. */
  interval: SubscriptionInterval | null;
  /** Max zones this user is allowed to create. */
  maxZones: number;
  /** Number of zones the current user has created. */
  zonesIOwn: number;
  /** Can this user create a walking zone? (tier check only — see canCreateNewZone for the full gate). */
  canCreateZone: boolean;
  /** Can this user join a walking zone? */
  canJoinZone: boolean;
  /**
   * Final, canonical "can the user create another zone right now" flag.
   * Combines tier (`hasActiveSocial`) with quota (`zonesIOwn < maxZones`).
   * UI should use this; backend RLS still enforces both independently.
   */
  canCreateNewZone: boolean;
  /** True when the user has reached their per-tier zone-creation quota. */
  reachedZoneLimit: boolean;
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  status: 'expired',
  hasActiveSocial: false,
  isTrialing: false,
  isActivePaid: false,
  daysLeftInTrial: 0,
  trialEndsAt: null,
  interval: null,
  maxZones: 0,
  zonesIOwn: 0,
  canCreateZone: false,
  canJoinZone: false,
  canCreateNewZone: false,
  reachedZoneLimit: false,
};

export function useSubscription(): SubscriptionState {
  const { user, userProfile, walkingZones } = useApp();

  return useMemo(() => {
    if (!userProfile) return DEFAULT_STATE;

    const tier: SubscriptionTier = userProfile.subscription_tier ?? 'free';
    const status: SubscriptionStatus = userProfile.subscription_status ?? 'expired';
    const trialEndsAt = userProfile.trial_ends_at ?? null;
    const currentPeriodEnd = userProfile.current_period_end ?? null;
    const now = Date.now();

    const trialActive =
      status === 'trialing' && !!trialEndsAt && new Date(trialEndsAt).getTime() > now;
    const paidActive =
      status === 'active' &&
      (!currentPeriodEnd || new Date(currentPeriodEnd).getTime() > now);

    const hasActiveSocial = tier === 'social' && (trialActive || paidActive);

    let daysLeftInTrial = 0;
    if (trialActive && trialEndsAt) {
      const ms = new Date(trialEndsAt).getTime() - now;
      daysLeftInTrial = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    const maxZones = paidActive ? 5 : trialActive ? 1 : 0;
    const zonesIOwn = user
      ? walkingZones.filter(z => z.creator_id === user.id).length
      : 0;
    const reachedZoneLimit = zonesIOwn >= maxZones;
    const canCreateNewZone = hasActiveSocial && !reachedZoneLimit;

    return {
      tier,
      status,
      hasActiveSocial,
      isTrialing: trialActive,
      isActivePaid: paidActive,
      daysLeftInTrial,
      trialEndsAt,
      interval: userProfile.subscription_interval ?? null,
      maxZones,
      zonesIOwn,
      canCreateZone: hasActiveSocial,
      canJoinZone: hasActiveSocial,
      canCreateNewZone,
      reachedZoneLimit,
    };
  }, [userProfile, user, walkingZones]);
}
