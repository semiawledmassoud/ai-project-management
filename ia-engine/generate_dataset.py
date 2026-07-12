"""
PREDYNEX — Génération Dataset v2
2000 projets · 17 features · 4 targets

Commande : python generate_dataset.py
"""
import pandas as pd
import numpy as np

np.random.seed(42)
N = 2000

methods = ['Scrum', 'Kanban', 'Waterfall', 'Agile']
sectors = ['IT', 'Finance', 'Santé', 'Industrie', 'E-commerce', 'Telecom', 'Education', 'Logistique']

rows = []
for i in range(N):
    method   = np.random.choice(methods, p=[0.40, 0.25, 0.20, 0.15])
    sector   = np.random.choice(sectors)
    team     = np.random.randint(2, 25)
    budget   = round(np.random.uniform(15000, 600000), -3)
    duration = np.random.randint(30, 400)
    sprints  = max(1, duration // 14)

    base_v   = {'Scrum': 78, 'Kanban': 62, 'Agile': 71, 'Waterfall': 50}[method]
    velocity = max(5, int(np.random.normal(base_v, 18)))

    overscoped   = np.random.random() < 0.28
    team_issues  = np.random.random() < 0.22
    tech_debt    = np.random.random() < 0.18
    scope_creep  = np.random.random() < 0.25
    key_person   = np.random.random() < 0.20
    unclear_req  = np.random.random() < 0.23

    br = np.random.uniform(0.25, 0.68)
    if overscoped:  br += np.random.uniform(0.08, 0.32)
    if scope_creep: br += np.random.uniform(0.05, 0.18)
    if tech_debt:   br += np.random.uniform(0.03, 0.12)
    br = min(br, 1.55)
    budget_used = round(budget * br, -2)

    progress     = max(5, min(100, int(np.random.normal((velocity/100)*78, 14))))
    open_tickets = max(0, int(np.random.normal(22 - velocity/5, 9)))
    absences     = max(0, int(np.random.normal((3 if team_issues else 0.8) + (2 if key_person else 0), 1.5)))
    meetings_pw  = np.random.choice([0, 1, 2, 3, 4], p=[0.05, 0.15, 0.40, 0.30, 0.10])
    doc_score    = max(0, min(10, np.random.normal(3 if unclear_req else 7, 1.8)))

    score = 5.0
    score += (progress / 100) * 3.2
    score -= max(0, br - 0.65) * 4.5
    score += (min(velocity, 100) / 100) * 2.2
    score -= open_tickets * 0.055
    score -= absences * 0.28
    score += (meetings_pw / 4) * 0.8
    score += (doc_score / 10) * 0.6
    if overscoped:  score -= 1.6
    if team_issues: score -= 1.3
    if tech_debt:   score -= 0.9
    if scope_creep: score -= 1.1
    if key_person:  score -= 0.8
    if unclear_req: score -= 0.7
    score = round(float(np.clip(score + np.random.normal(0, 0.45), 1.0, 10.0)), 1)

    delay        = max(0, int(np.random.normal((10-score)*7.5, 4))) if score < 5.5 else 0
    overrun      = round(max(0, (br - 1.0)*100), 1) if br > 1.0 else 0.0
    success      = 1 if score >= 6.0 and delay < 25 and overrun < 15 else 0
    risk_cat     = 0 if score >= 7.5 else 1 if score >= 6.0 else 2 if score >= 4.5 else 3

    rows.append({
        'method_enc':            ['Agile', 'Kanban', 'Scrum', 'Waterfall'].index(method),
        'team_size':             team,
        'budget_ratio':          round(br, 3),
        'progress':              progress,
        'velocity':              velocity,
        'open_tickets':          open_tickets,
        'absences':              absences,
        'overscoped':            int(overscoped),
        'team_issues':           int(team_issues),
        'tech_debt':             int(tech_debt),
        'scope_creep':           int(scope_creep),
        'key_person_risk':       int(key_person),
        'unclear_requirements':  int(unclear_req),
        'meetings_per_week':     meetings_pw,
        'doc_score':             round(doc_score, 1),
        'duration_planned':      duration,
        'sprints_count':         sprints,
        'ai_score':              score,
        'delay_days':            delay,
        'overrun_pct':           overrun,
        'success':               success,
        'risk_category':         risk_cat,
        'methodology':           method,
        'sector':                sector,
        'budget':                budget,
    })

df = pd.DataFrame(rows)
df.to_csv('dataset_v2.csv', index=False)
print(f"✅ Dataset généré : {len(df)} projets | {len(df.columns)} colonnes")
print(f"   Score moyen  : {df['ai_score'].mean():.2f}/10")
print(f"   Taux succès  : {df['success'].mean()*100:.1f}%")
print(f"   Délai moyen  : {df['delay_days'].mean():.1f}j")
print(f"\n→ Lance maintenant : python train_model.py")
