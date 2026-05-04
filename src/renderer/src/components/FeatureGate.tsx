/**
 * FeatureGate — renders children only when the feature is accessible.
 * Shows an upgrade prompt (or custom fallback) when access is blocked.
 */
import React from 'react';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { FEATURES } from '../../../shared/features';

interface FeatureGateProps {
  /** Feature key from FEATURES registry (e.g. 'smart.ocr') */
  feature: string;
  children: React.ReactNode;
  /**
   * Custom content to render when access is blocked.
   * If omitted, renders the default inline upgrade prompt.
   */
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps): React.ReactElement {
  const gate = useFeatureGate(feature);

  if (gate.allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <DefaultUpgradePrompt gate={gate} featureKey={feature} />;
}

// ── Default inline upgrade prompt ────────────────────────────────────────────

interface DefaultUpgradePromptProps {
  gate: ReturnType<typeof useFeatureGate>;
  featureKey: string;
}

function DefaultUpgradePrompt({ gate, featureKey }: DefaultUpgradePromptProps): React.ReactElement {
  const feature = FEATURES[featureKey];
  const icon = feature?.icon ?? '⭐';
  const label = feature?.label ?? featureKey;

  const isLimitReached = gate.reason === 'limit_reached';

  return (
    <div className="feature-gate-prompt" role="status" aria-label={`${label} is locked`}>
      <span className="feature-gate-icon">{icon}</span>
      <div className="feature-gate-content">
        <span className="feature-gate-label">{label}</span>
        <span className="feature-gate-reason">
          {isLimitReached
            ? `Daily limit reached (${gate.dailyLimit}/day). Upgrade to Pro for unlimited access.`
            : 'This feature requires SnapForge Pro.'}
        </span>
      </div>
      <button
        className="feature-gate-btn"
        onClick={() => {
          // Phase 5: will open Stripe Checkout.
          // For now, show a placeholder alert.
          alert('Upgrade to SnapForge Pro coming soon!');
        }}
      >
        {isLimitReached ? '⬆ Upgrade' : '⭐ Go Pro'}
      </button>
    </div>
  );
}

export default FeatureGate;
