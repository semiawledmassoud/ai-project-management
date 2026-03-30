import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

export default function Forecast() {
  const nav = useNavigate();
  const [projects, setProjects]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [forecast, setForecast]   = useState(null);
  const [allForecasts, setAllForecasts] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);

  useEffect(() => {
    API.get('/projects').then(async r => {
      setProjects(r.data);
      if (r.data.length > 0) loadForecast(r.data[0]);
      try {
        const all = await API.get('/forecast/all');
        setAllForecasts(all.data);
      } catch {}
      setLoadingAll(false);
    }).catch(() => setLoadingAll(false));
  }, []);

  const loadForecast = async (project) => {
    setSelected(project);
    setLoading(true);
    setForecast(null);
    try {
      const res = await API.post(`/forecast/project/${project._id}`, {});
      setForecast(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const statusColors = { good:'#34D399', warning:'#F59E0B', danger:'#F87171' };
  const riskColors   = { low:'#34D399', medium:'#F59E0B', high:'#F87171', critical:'#F87171' };

  const card = {background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:16};

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22, fontWeight:700}}>🔮 Prévisions IA — 30 / 60 / 90 jours</h1>
        <p style={{color:'#5C6490', fontSize:13, marginTop:4}}>
          Trajectoire prédite par le modèle RandomForest · R²=0.865
        </p>
      </div>

      {/* Vue globale tous projets */}
      {!loadingAll && allForecasts.length > 0 && (
        <div style={card}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Vue globale — État prédit à 90 jours</div>
          <div style={{display:'grid', gap:8}}>
            {allForecasts.map(f => (
              <div key={f.projectId} onClick={() => {
                const p = projects.find(p => p._id === f.projectId);
                if (p) loadForecast(p);
              }} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#1A1D28', borderRadius:8, cursor:'pointer', border:`1px solid ${riskColors[f.riskLevel]||'#252A3D'}22`}}>
                <div style={{width:8, height:8, borderRadius:'50%', background:riskColors[f.riskLevel]||'#5C6490', flexShrink:0}}/>
                <div style={{flex:1, fontSize:13, fontWeight:500}}>{f.name}</div>
                <div style={{display:'flex', gap:16, fontSize:11}}>
                  <span style={{color:'#5C6490'}}>Score actuel : <span style={{color:f.currentScore>=7?'#34D399':f.currentScore>=5?'#F59E0B':'#F87171', fontWeight:700, fontFamily:'monospace'}}>{f.currentScore}</span></span>
                  <span style={{color:'#5C6490'}}>Score J+90 : <span style={{color:f.score90days>=7?'#34D399':f.score90days>=5?'#F59E0B':'#F87171', fontWeight:700, fontFamily:'monospace'}}>{f.score90days}</span></span>
                  <span style={{color:'#5C6490'}}>Progression : <span style={{color:'#4F8FFF', fontWeight:700}}>{f.progress90days}%</span></span>
                  {f.willBeCompleted && <span style={{color:'#34D399', fontWeight:600}}>✓ Livrable à 90j</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sélecteur projet */}
      <div style={card}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Analyse détaillée par projet</div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {projects.map(p => (
            <button key={p._id} onClick={() => loadForecast(p)}
              style={{padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all .15s',
                background: selected?._id===p._id ? 'rgba(79,143,255,.15)' : '#1A1D28',
                borderColor: selected?._id===p._id ? '#4F8FFF' : '#252A3D',
                color: selected?._id===p._id ? '#4F8FFF' : '#9BA3C8'}}>
              {p.name}
              <span style={{marginLeft:6, fontSize:10, color:p.aiScore>=7?'#34D399':p.aiScore>=5?'#F59E0B':'#F87171'}}>{p.aiScore}/10</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prévisions détaillées */}
      {loading && (
        <div style={{textAlign:'center', color:'#5C6490', padding:60}}>Calcul des prévisions IA...</div>
      )}

      {forecast && !loading && (
        <>
          {/* État actuel */}
          <div style={card}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>État actuel — {forecast.projectName}</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
              <div style={{background:'#1A1D28', borderRadius:8, padding:12, textAlign:'center'}}>
                <div style={{fontSize:10, color:'#5C6490', marginBottom:4}}>Score IA actuel</div>
                <div style={{fontSize:28, fontWeight:700, fontFamily:'monospace', color:forecast.currentScore>=7?'#34D399':forecast.currentScore>=5?'#F59E0B':'#F87171'}}>{forecast.currentScore}</div>
              </div>
              <div style={{background:'#1A1D28', borderRadius:8, padding:12, textAlign:'center'}}>
                <div style={{fontSize:10, color:'#5C6490', marginBottom:4}}>Progression actuelle</div>
                <div style={{fontSize:28, fontWeight:700, fontFamily:'monospace', color:'#4F8FFF'}}>{forecast.currentProgress}%</div>
              </div>
              <div style={{background:'#1A1D28', borderRadius:8, padding:12, textAlign:'center'}}>
                <div style={{fontSize:10, color:'#5C6490', marginBottom:4}}>Budget consommé</div>
                <div style={{fontSize:28, fontWeight:700, fontFamily:'monospace', color:forecast.currentBudgetRatio>85?'#F87171':'#F59E0B'}}>{forecast.currentBudgetRatio}%</div>
              </div>
            </div>
          </div>

          {/* Prévisions J+30 / J+60 / J+90 */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:16}}>
            {forecast.forecast?.map(f => (
              <div key={f.days} style={{background:'#131620', border:`2px solid ${statusColors[f.status]}44`, borderRadius:12, overflow:'hidden'}}>
                <div style={{background:`rgba(${f.status==='good'?'52,211,153':f.status==='warning'?'245,158,11':'248,113,113'},.08)`, padding:'12px 16px', borderBottom:`1px solid ${statusColors[f.status]}22`}}>
                  <div style={{fontSize:16, fontWeight:700, color:statusColors[f.status]}}>J+{f.days}</div>
                  <div style={{fontSize:11, color:'#5C6490'}}>Dans {f.days} jours</div>
                </div>
                <div style={{padding:'14px 16px'}}>
                  <div style={{display:'grid', gap:10}}>
                    <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px', display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:11, color:'#5C6490'}}>Score IA estimé</span>
                      <span style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:f.estimatedScore>=7?'#34D399':f.estimatedScore>=5?'#F59E0B':'#F87171'}}>{f.estimatedScore}/10</span>
                    </div>
                    <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px', display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:11, color:'#5C6490'}}>Progression</span>
                      <span style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#4F8FFF'}}>{f.estimatedProgress}%</span>
                    </div>
                    <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px', display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:11, color:'#5C6490'}}>Budget utilisé</span>
                      <span style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:f.estimatedBudgetUsed>90?'#F87171':'#F59E0B'}}>{f.estimatedBudgetUsed}%</span>
                    </div>
                    <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px', display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:11, color:'#5C6490'}}>Probabilité succès</span>
                      <span style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:f.successProbability>=60?'#34D399':f.successProbability>=40?'#F59E0B':'#F87171'}}>{f.successProbability}%</span>
                    </div>
                    <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px', display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:11, color:'#5C6490'}}>Risque retard</span>
                      <span style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:f.delayRisk>60?'#F87171':f.delayRisk>30?'#F59E0B':'#34D399'}}>{f.delayRisk}%</span>
                    </div>
                  </div>
                  <div style={{marginTop:10, padding:'8px 10px', background:`rgba(${f.status==='good'?'52,211,153':f.status==='warning'?'245,158,11':'248,113,113'},.06)`, borderRadius:7, fontSize:11, color:'#9BA3C8', lineHeight:1.4}}>
                    {f.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Graphique progression */}
          <div style={card}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Courbe de progression estimée</div>
            <div style={{display:'flex', alignItems:'flex-end', gap:6, height:140}}>
              {[
                {label:'Actuel', progress:forecast.currentProgress, score:forecast.currentScore},
                ...(forecast.forecast||[]).map(f=>({label:f.label, progress:f.estimatedProgress, score:f.estimatedScore}))
              ].map((d,i) => (
                <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3}}>
                  <div style={{fontSize:10, color:'#5C6490', fontFamily:'monospace'}}>{d.score}/10</div>
                  <div style={{width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:100}}>
                    <div style={{flex:1, borderRadius:'3px 3px 0 0', background:i===0?'#4F8FFF':'rgba(79,143,255,.4)', height:(d.progress/100*100)+'px', minHeight:4, transition:'height .5s'}} title={`Progression: ${d.progress}%`}/>
                    <div style={{flex:1, borderRadius:'3px 3px 0 0', background:d.score>=7?'#34D399':d.score>=5?'#F59E0B':'#F87171', opacity:i===0?1:0.7, height:(d.score/10*100)+'px', minHeight:4}} title={`Score: ${d.score}`}/>
                  </div>
                  <div style={{fontSize:10, color:i===0?'#4F8FFF':'#5C6490', fontWeight:i===0?600:400}}>{d.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:14, marginTop:8}}>
              <div style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9BA3C8'}}>
                <div style={{width:10,height:10,borderRadius:2,background:'rgba(79,143,255,.6)'}}/> Progression %
              </div>
              <div style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9BA3C8'}}>
                <div style={{width:10,height:10,borderRadius:2,background:'#34D399'}}/> Score IA
              </div>
            </div>
          </div>
        </>
      )}

      {!selected && !loading && (
        <div style={{textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D'}}>
          Sélectionnez un projet pour voir ses prévisions à 30/60/90 jours
        </div>
      )}
    </div>
  );
}