"""
ProAI — Entraînement des 4 modèles ML
======================================
Commande : python train_model.py

Modèles entraînés :
  1. RandomForestRegressor       → Score IA (1-10)        R²=0.865
  2. GradientBoostingClassifier  → Succès/Échec           Acc=89%
  3. GradientBoostingClassifier  → Catégorie risque       Acc=68%
  4. GradientBoostingRegressor   → Délai prédit (jours)   MAE=8.3j
"""
import pandas as pd
import numpy as np
import pickle, json
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor
)
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    mean_absolute_error, r2_score,
    accuracy_score, classification_report
)

print("Chargement du dataset...")
df = pd.read_csv('dataset_v2.csv')
print(f"  {len(df)} projets chargés\n")

FEATURES = [
    'method_enc', 'team_size', 'budget_ratio', 'progress', 'velocity',
    'open_tickets', 'absences', 'overscoped', 'team_issues', 'tech_debt',
    'scope_creep', 'key_person_risk', 'unclear_requirements',
    'meetings_per_week', 'doc_score', 'duration_planned', 'sprints_count'
]

X = df[FEATURES]

# ── Modèle 1 : Score IA ───────────────────────────────────────────────────────
print("1/4 Entraînement Score IA (RandomForest)...")
y_score = df['ai_score']
Xs_tr, Xs_te, ys_tr, ys_te = train_test_split(X, y_score, test_size=0.2, random_state=42)

rf = RandomForestRegressor(
    n_estimators=300, max_depth=14, min_samples_leaf=3,
    max_features='sqrt', random_state=42, n_jobs=-1
)
rf.fit(Xs_tr, ys_tr)
pred_s = rf.predict(Xs_te)
mae  = mean_absolute_error(ys_te, pred_s)
r2   = r2_score(ys_te, pred_s)
cv   = cross_val_score(rf, X, y_score, cv=5, scoring='r2')
print(f"   MAE={mae:.3f} | R²={r2:.3f} | CV={cv.mean():.3f}±{cv.std():.3f}")

# ── Modèle 2 : Succès/Échec ───────────────────────────────────────────────────
print("2/4 Entraînement Succès/Échec (GradientBoosting)...")
y_succ = df['success']
Xc_tr, Xc_te, yc_tr, yc_te = train_test_split(X, y_succ, test_size=0.2, random_state=42)

gb = GradientBoostingClassifier(
    n_estimators=200, learning_rate=0.08, max_depth=6,
    subsample=0.85, random_state=42
)
gb.fit(Xc_tr, yc_tr)
pred_c = gb.predict(Xc_te)
acc = accuracy_score(yc_te, pred_c)
print(f"   Accuracy={acc:.3f}")
print(classification_report(yc_te, pred_c, target_names=['Échec', 'Succès']))

# ── Modèle 3 : Catégorie de risque ────────────────────────────────────────────
print("3/4 Entraînement Catégorie risque (GradientBoosting 4 classes)...")
y_risk = df['risk_category']
Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(X, y_risk, test_size=0.2, random_state=42)

gb_risk = GradientBoostingClassifier(
    n_estimators=200, learning_rate=0.08, max_depth=5, random_state=42
)
gb_risk.fit(Xr_tr, yr_tr)
pred_r = gb_risk.predict(Xr_te)
acc_r = accuracy_score(yr_te, pred_r)
print(f"   Accuracy={acc_r:.3f}")
print(classification_report(yr_te, pred_r, target_names=['Faible', 'Modéré', 'Élevé', 'Critique']))

# ── Modèle 4 : Délai prédit ───────────────────────────────────────────────────
print("4/4 Entraînement Délai (GradientBoosting régression)...")
y_delay = df['delay_days']
Xd_tr, Xd_te, yd_tr, yd_te = train_test_split(X, y_delay, test_size=0.2, random_state=42)

gb_delay = GradientBoostingRegressor(
    n_estimators=150, learning_rate=0.1, max_depth=5, random_state=42
)
gb_delay.fit(Xd_tr, yd_tr)
pred_d = gb_delay.predict(Xd_te)
mae_d = mean_absolute_error(yd_te, pred_d)
r2_d  = r2_score(yd_te, pred_d)
print(f"   MAE={mae_d:.2f}j | R²={r2_d:.3f}")

# ── Feature importances ───────────────────────────────────────────────────────
feat_imp = sorted(zip(FEATURES, rf.feature_importances_), key=lambda x: x[1], reverse=True)
print("\n[Feature Importances — RandomForest Score]")
for f, v in feat_imp:
    bar = '█' * int(v * 60)
    print(f"  {f:<28} {bar} {v:.4f}")

# ── Sauvegarde ────────────────────────────────────────────────────────────────
for name, obj in [
    ('model_score.pkl',         rf),
    ('model_success.pkl',       gb),
    ('model_risk_category.pkl', gb_risk),
    ('model_delay.pkl',         gb_delay),
]:
    with open(name, 'wb') as f:
        pickle.dump(obj, f)

meta = {
    'features':       FEATURES,
    'n_features':     len(FEATURES),
    'n_train':        int(len(Xs_tr)),
    'n_total':        int(len(df)),
    'score_model':    {'mae': round(float(mae), 3), 'r2': round(float(r2), 3), 'cv_r2': round(float(cv.mean()), 3)},
    'success_model':  {'accuracy': round(float(acc), 3)},
    'risk_model':     {'accuracy': round(float(acc_r), 3)},
    'delay_model':    {'mae': round(float(mae_d), 2), 'r2': round(float(r2_d), 3)},
    'feature_importances': {k: round(float(v), 4) for k, v in feat_imp},
    'methodology_map': {'Agile': 0, 'Kanban': 1, 'Scrum': 2, 'Waterfall': 3},
    'risk_categories': ['faible', 'modéré', 'élevé', 'critique'],
}
with open('model_meta_v2.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

print("\n✅ Modèles sauvegardés :")
print("   model_score.pkl         → Score IA 1-10")
print("   model_success.pkl       → Succès/Échec")
print("   model_risk_category.pkl → Catégorie risque")
print("   model_delay.pkl         → Délai prédit")
print("   model_meta_v2.json      → Métriques")
print(f"\n→ Lance maintenant : python app.py")
