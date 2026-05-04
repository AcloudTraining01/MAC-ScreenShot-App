/**
 * useAuth — convenience hook that surfaces auth + tier + gating helpers.
 *
 * In Phase 5 this will integrate Supabase Auth. For now it exposes the
 * authStore and provides a signIn stub ready to be wired up.
 */
import { useAuthStore } from '../store/authStore';
import { useFeatureGate } from './useFeatureGate';

export function useAuth() {
  const { user, tier, dailyUsage, incrementUsage, resetDailyUsage, signOut, setUser, setTier } =
    useAuthStore();

  const isPro = tier === 'pro';

  /** Record a feature use and increment the daily counter */
  function consumeFeature(featureKey: string): void {
    incrementUsage(featureKey);
  }

  return {
    user,
    tier,
    isPro,
    dailyUsage,
    consumeFeature,
    resetDailyUsage,
    signOut,
    // Stubs for Phase 5 Supabase integration
    signIn: async (_email: string, _password: string): Promise<void> => {
      console.warn('[Auth] Supabase sign-in not yet wired up (Phase 5).');
    },
    signUp: async (_email: string, _password: string): Promise<void> => {
      console.warn('[Auth] Supabase sign-up not yet wired up (Phase 5).');
    },
    // Internal — used by licensing.ts to set the resolved tier
    _setUser: setUser,
    _setTier: setTier,
  };
}

// Re-export so consumers only need to import from this file
export { useFeatureGate };
