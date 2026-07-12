import React, { useState } from 'react';
import RiskBadge from './RiskBadge';

/**
 * Carte de risque professionnelle — affiche :
 *   title, description, probability%, impact badge, severity_score, solution
 * Avec ombre douce, effet hover, et expansion au clic.
 */
export default function RiskCard({ risk, onViewProject }) {
  const [expanded, setExpanded] = useState(false);

  const impactLower = (risk.impact || 'Medium').toLowerCase();
  const impactColorVar = impactLower === 'high' ? 'var(--red)'
    : impactLower === 'medium' ? 'var(--amber)'
    : 'var(--green)';

  return (
    <div
      className={`risk-card impact-${impactLower}`}
      style={{ padding: '16px 20px', marginBottom: 12 }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Severity score circle */}
        <div style={{
          width: 52, height: 52, borderRadius: 12, flexShrink: 0,
          background: `color-mix(in srgb, ${impactColorVar} 12%, var(--bg3))`,
          border: `1px solid color-mix(in srgb, ${impactColorVar} 30%, transparent)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: impactColorVar, fontFamily: 'monospace' }}>
            {risk.severity_score ?? risk.probability}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>score</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <RiskBadge level={risk.impact}>{risk.impact} impact</RiskBadge>
            {risk.ai_detected && (
              <span style={{ fontSize: 10, background: 'var(--purple-bg)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 12, fontFamily: 'monospace' }}>
                ◈ AI
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 600 }}>
              {risk.probability}% probability
            </span>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {risk.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            {risk.description}
          </div>

          {expanded && risk.solution && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 10,
              background: 'var(--bg3)', borderLeft: `3px solid ${impactColorVar}`
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 700 }}>
                Recommended solution
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                → {risk.solution}
              </div>
              {onViewProject && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewProject(); }}
                  className="btn-hover"
                  style={{
                    marginTop: 10, background: 'var(--blue-bg)', color: 'var(--blue)',
                    border: `1px solid color-mix(in srgb, var(--blue) 25%, transparent)`,
                    borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  View project →
                </button>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            {expanded ? '▲ Hide solution' : '▼ Show solution'}
          </div>
        </div>
      </div>
    </div>
  );
}