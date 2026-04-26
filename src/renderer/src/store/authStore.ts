/**
 * Auth Store — holds user authentication state, subscription tier,
 * and daily feature usage counts for free-tier limit enforcement.
 *
 * On initialization, the store hydrates the real tier from the main
 * process licensing manager via `window.api.getTier()`.
 *
 * Phase 5 will wire this to Supabase Auth for sign-in/sign-up.
 */
import { create } from 'zustand';
import type { UserProfile, UserTier, LicenseValidationResult } from '../../../shared/types';

/** Maps feature key → number of uses today */
type DailyUsageMap = Record<string, number>;

interface AuthState {
  /** Null means not signed in */
  user: UserProfile | null;
  tier: UserTier;
  /** Daily usage counts, keyed by feature key */
  dailyUsage: DailyUsageMap;
  isLoading: boolean;
  /** Whether the real tier has been loaded from the license manager */
  isHydrated: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setTier: (tier: UserTier) => void;
  /** Increment today's usage count for a feature */
  incrementUsage: (featureKey: string) => void;
  /** Reset daily usage (called at midnight) */
  resetDailyUsage: () => void;
  signOut: () => void;
  /**
   * Hydrate the tier from the main process licensing manager.
   * Call once on app startup (e.g. in App.tsx useEffect).
   */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tier: 'free',
  dailyUsage: {},
  isLoading: false,
  isHydrated: false,

  setUser: (user) =>
    set({
      user,
      tier: user?.tier ?? 'free',
    }),

  setTier: (tier) => set({ tier }),

  incrementUsage: (featureKey) =>
    set((state) => ({
      dailyUsage: {
        ...state.dailyUsage,
        [featureKey]: (state.dailyUsage[featureKey] ?? 0) + 1,
      },
    })),

  resetDailyUsage: () => set({ dailyUsage: {} }),

  signOut: () =>
    set({
      user: null,
      tier: 'free',
      dailyUsage: {},
    }),

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const result: LicenseValidationResult = await window.api.getTier();
      const tier: UserTier = result.valid ? result.tier : 'free';
      const user: UserProfile | null = result.valid
        ? {
            id: 'local',
            email: result.email,
            tier,
            subscriptionStatus: 'active',
          }
        : null;
      set({ tier, user, isHydrated: true });
      console.log('[AuthStore] Hydrated tier:', tier);
    } catch (err) {
      console.error('[AuthStore] Failed to hydrate tier from license manager:', err);
      set({ tier: 'free', isHydrated: true });
    } finally {
      set({ isLoading: false });
    }
  },
}));
