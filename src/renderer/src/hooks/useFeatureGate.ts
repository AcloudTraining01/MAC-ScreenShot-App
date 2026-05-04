/**
 * useFeatureGate — React hook for checking feature access.
 *
 * Reads user tier from authStore and daily usage, then delegates
 * to the shared checkFeatureAccess() logic in features.ts.
 */
import { useAuthStore } from '../store/authStore';
import { checkFeatureAccess, FEATURES, type FeatureConfig } from '../../../shared/features';

export interface FeatureGateResult {
  allowed: boolean;
  reason?: 'pro_required' | 'limit_reached';
  feature?: FeatureConfig;
  /** How many times this feature has been used today (free users only) */
  todayUsage: number;
  /** The daily cap, if one exists */
  dailyLimit?: number;
  /** Remaining uses today (only meaningful for rate-limited features) */
  remaining?: number;
}

export function useFeatureGate(featureKey: string): FeatureGateResult {
  const { tier, dailyUsage } = useAuthStore();
  const todayUsage = dailyUsage[featureKey] ?? 0;

  const result = checkFeatureAccess(featureKey, tier, todayUsage);
  const feature = FEATURES[featureKey];
  const dailyLimit = feature?.dailyLimit;

  return {
    ...result,
    todayUsage,
    dailyLimit,
    remaining:
      dailyLimit !== undefined ? Math.max(0, dailyLimit - todayUsage) : undefined,
  };
}
