import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { useLocale } from '../context/LocaleContext';

export default function Recommendations() {
  const [allRecs, setAllRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLocale();

  useEffect(() => {
    API.get('/projects').then(async r => {
      const recs = [];
      for (const p of r.data) {
        try {
          const res = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          });
          const data = await res.json();
          data.recommendations?.forEach(rec => recs.push({ ...rec, projectName: p.name }));
        } catch {}
      }
      setAllRecs(recs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const priorityColor = { urgent:'#F87171', high:'#F59E0B', medium:'#4F8FFF' };

  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>{t('aiRecommendations', 'Recommandations IA')}</h1>
      <p style={{ color:'#5C6490', fontSize:13, marginBottom:20 }}>
        {allRecs.length} {t('recommendationsCount', 'recommandation(s) générée(s)')}
      </p>

      {loading && (
        <div style={{ textAlign:'center', color:'#5C6490', padding:40 }}>
          Analyse en cours...
        </div>
      )}

      <div style={{ display:'grid', gap:12 }}>
        <div style={{ background: '#0F172A', border: '1px solid #333C5C', borderRadius: 12, padding: 14, color: '#E8EAF6', fontSize: 12 }}>
          <strong>{t('detailedDescription', 'Guide pro')} :</strong> Décrivez les risques et recommandations avec des objectifs clairs, des actions mesurables et des échéances.
        </div>
        {allRecs.map((rec,i) => (
          <div key={i} style={{ background:'#131620', border:'1px solid rgba(79,143,255,.15)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:10, background:`rgba(${rec.priority==='urgent'?'248,113,113':'79,143,255'},.1)`, color:priorityColor[rec.priority]||'#4F8FFF', padding:'2px 8px', borderRadius:5, fontWeight:600 }}>
                {(rec.priority||'medium').toUpperCase()}
              </span>
              <span style={{ fontSize:11, color:'#5C6490' }}>{rec.projectName}</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#34D399' }}>
                {t('saved', 'Confiance')} {rec.confidence}%
              </span>
            </div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{rec.title}</div>
            <div style={{ fontSize:12, color:'#9BA3C8', lineHeight:1.5, marginBottom:6 }}>{t('detailedDescription', 'Description détaillée')}: {rec.description || t('noData', 'Aucune donnée disponible')}</div>
            <div style={{ fontSize:12, color:'#4F8FFF', marginBottom:6 }}>{t('aiRecommendations', 'Recommandation')}: {rec.impact || t('noData', 'Aucune donnée disponible')}</div>
            <div style={{ fontSize:11, color:'#5C6490' }}>{t('impactEstimated', 'Impact estimé')}: {rec.effort || 'N/A'} · {t('projectHealth', 'Priorité')}: {rec.priority || 'medium'}</div>
          </div>
        ))}

        {!loading && allRecs.length === 0 && (
          <div style={{ textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D' }}>
            Créez des projets et lancez python app.py pour recevoir des recommandations
          </div>
        )}
      </div>
    </div>
  );
}