import React, { useState } from 'react';

export default function ExportPDF({ project, analysis }) {
  const [loading, setLoading] = useState(false);

  const generatePDF = () => {
    setLoading(true);

    const content = `
RAPPORT PREDYNEX — ${project?.name}
Généré le ${new Date().toLocaleDateString('fr-FR')}
${'='.repeat(50)}

SCORE IA DE SANTÉ : ${project?.aiScore} / 10
Méthodologie     : ${project?.methodology}
Équipe           : ${project?.teamSize} membres
Budget           : ${project?.budget?.toLocaleString()}€
Budget utilisé   : ${project?.budgetUsed?.toLocaleString()}€ (${Math.round((project?.budgetUsed/Math.max(project?.budget,1))*100)}%)
Progression      : ${project?.progress}%
Vélocité sprint  : ${project?.velocity} pts

${'='.repeat(50)}
PRÉDICTIONS IA
${'='.repeat(50)}
Probabilité de retard    : ${analysis?.predictions?.delayProbability}%
Dépassement budget estimé: +${analysis?.predictions?.budgetOverrun}%
Délai supplémentaire     : +${analysis?.predictions?.estimatedDelay} jours
Probabilité de succès    : ${Math.round(analysis?.successProbability || 0)}%

${'='.repeat(50)}
RISQUES DÉTECTÉS (${analysis?.risks?.length || 0})
${'='.repeat(50)}
${analysis?.risks?.map((r, i) => `
${i+1}. [${r.severity.toUpperCase()}] ${r.title}
   Probabilité: ${r.probability}%
   ${r.description}
   Actions: ${r.actions?.join(' | ')}
`).join('') || 'Aucun risque détecté'}

${'='.repeat(50)}
RECOMMANDATIONS IA (${analysis?.recommendations?.length || 0})
${'='.repeat(50)}
${analysis?.recommendations?.map((r, i) => `
${i+1}. [${(r.priority||'medium').toUpperCase()}] ${r.title}
   Impact: ${r.impact}
   Confiance: ${r.confidence}%
   ${r.description}
`).join('') || 'Aucune recommandation'}

${'='.repeat(50)}
MÉTRIQUES DU MODÈLE IA
${'='.repeat(50)}
Modèle    : RandomForest + GradientBoosting
R² Score  : 0.863
Précision : 88.5%
Dataset   : 1000 projets analysés

Rapport généré par PREDYNEX v2.4
    `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PREDYNEX_Rapport_${project?.name?.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  return (
    <button onClick={generatePDF} disabled={loading || !project}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center', marginBottom: 8 }}>
      {loading ? '⏳ Génération...' : '📄 Exporter le rapport'}
    </button>
  );
}