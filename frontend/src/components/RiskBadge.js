import React from 'react';

/**
 * Badge visuel pour les niveaux de risque/impact.
 * level : 'High' | 'Medium' | 'Low' (insensible à la casse)
 */
export default function RiskBadge({ level, children }) {
  const normalized = (level || 'medium').toLowerCase();
  const cls = normalized === 'high' ? 'badge-high'
    : normalized === 'medium' ? 'badge-medium'
    : 'badge-low';

  const icon = normalized === 'high' ? '●' : normalized === 'medium' ? '◐' : '○';

  return (
    <span className={`badge ${cls}`}>
      {icon} {children || level}
    </span>
  );
}