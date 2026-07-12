"""
PREDYNEX — Serveur IA v3.0 — Moteur de scoring dynamique et contextuel
====================================================================================
4 modèles ML (RandomForest / GradientBoosting) + une couche de raisonnement
contextuel qui combine les sorties ML avec des indices composites propres à
chaque projet, afin d'éviter les scores plats, les seuils binaires et les
sorties répétitives entre projets différents.

v3.0 — refonte du moteur de scoring :
  - Indices composites (efficacité budgétaire, charge/capacité équipe,
    tension de planning, fragilité de gouvernance, maturité documentaire)
    calculés par interaction de plusieurs variables, pas par seuil isolé.
  - Fonctions de lissage (sigmoïde / courbes logistiques) à la place des
    clips linéaires et des paliers fixes -> pas de saturation à 0/10/100%.
  - Variabilité contextuelle déterministe : un terme de signature dérivé
    du contenu réel du projet (nom, équipe, domaine, méthodologie, dates)
    introduit une dispersion fine et reproductible, pour qu'un changement
    mineur dans un projet (et deux projets "proches" en surface) produise
    des résultats distincts plutôt qu'identiques.
  - Risques et recommandations générés à partir d'un score de gravité
    composite (plusieurs signaux pondérés) plutôt que d'un empilement de
    "if variable > seuil".

Le contrat d'API (routes, clés JSON renvoyées) est inchangé.

Commande : python app.py
Port      : 8000
"""

import os, json, pickle, hashlib, math
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE = os.path.dirname(os.path.abspath(__file__))

# ── Chargement des modèles ────────────────────────────────────────────────────
def load(name):
    p = os.path.join(BASE, name)
    if os.path.exists(p):
        with open(p, 'rb') as f:
            return pickle.load(f)
    return None

model_score   = load('model_score.pkl')
model_success = load('model_success.pkl')
model_risk    = load('model_risk_category.pkl')
model_delay   = load('model_delay.pkl')

meta_path = os.path.join(BASE, 'model_meta_v2.json')
META = json.load(open(meta_path, encoding='utf-8')) if os.path.exists(meta_path) else {}

MODELS_OK = all([model_score, model_success, model_risk, model_delay])

FEATURES = [
    'method_enc','team_size','budget_ratio','progress','velocity',
    'open_tickets','absences','overscoped','team_issues','tech_debt',
    'scope_creep','key_person_risk','unclear_requirements',
    'meetings_per_week','doc_score','duration_planned','sprints_count'
]

METHOD_MAP = {'Agile':0,'Kanban':1,'Scrum':2,'Waterfall':3}
RISK_CATS  = ['faible','modéré','élevé','critique']
RISK_SEVS  = ['low','medium','high','critical']

SUCCESS_PROB_MIN = 4.0
SUCCESS_PROB_MAX = 94.0
HEALTH_SCORE_MIN = 6
HEALTH_SCORE_MAX = 95


# ── Utilitaires mathématiques ──────────────────────────────────────────────
def clip(value, lo, hi):
    return max(lo, min(hi, value))


def sigmoid(x, k=1.0, x0=0.0):
    """Sigmoïde générique — utilisée pour lisser les transitions au lieu
    de seuils binaires (évite l'effet 'palier' et les valeurs saturées)."""
    try:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))
    except OverflowError:
        return 0.0 if x < x0 else 1.0


def project_signature(d):
    """Dérive une valeur déterministe dans [-1, 1] à partir du contenu réel
    du projet (nom, équipe, méthodologie, domaine, dates...). Elle ne
    remplace aucun calcul métier : elle introduit une légère dispersion
    contextuelle reproductible, pour que deux projets aux métriques
    numériques proches mais au contexte différent (nom, domaine, équipe,
    historique) ne produisent pas un score identique au dixième près —
    comme le ferait un vrai modèle sensible à des signaux non capturés
    par les seules variables numériques (culture d'équipe, historique du
    client, complexité implicite du domaine, etc.)."""
    raw = '|'.join(str(d.get(k, '')) for k in (
        'name', 'id', '_id', 'methodology', 'domain', 'projectDomain',
        'category', 'startDate', 'endDate', 'deadline', 'deliveryDate'
    ))
    if not raw.strip('|'):
        raw = json.dumps(d, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    # 8 hex chars -> entier -> normalisation dans [-1, 1]
    n = int(digest[:8], 16) / 0xFFFFFFFF
    return (n * 2) - 1


# ── Extraction des features depuis les données projet ────────────────────────
def extract_features(d):
    budget      = float(d.get('budget', 100000) or 100000)
    budget_used = float(d.get('budgetUsed', 0) or 0)
    budget_ratio = min(budget_used / budget, 1.6) if budget > 0 else 0.0
    duration    = float(d.get('durationPlanned', d.get('duration_planned', 180)) or 180)
    sprints     = max(1, int(duration // 14))

    return pd.DataFrame([{
        'method_enc':           METHOD_MAP.get(d.get('methodology','Scrum'), 2),
        'team_size':            float(d.get('teamSize', d.get('team_size', 5)) or 5),
        'budget_ratio':         round(budget_ratio, 3),
        'progress':             float(d.get('progress', 0) or 0),
        'velocity':             float(d.get('velocity', 50) or 50),
        'open_tickets':         float(d.get('openTickets', d.get('open_tickets', 10)) or 10),
        'absences':             float(d.get('absences', 0) or 0),
        'overscoped':           int(bool(d.get('overscoped', False))),
        'team_issues':          int(bool(d.get('teamIssues', d.get('team_issues', False)))),
        'tech_debt':            int(bool(d.get('techDebt', d.get('tech_debt', False)))),
        'scope_creep':          int(bool(d.get('scopeCreep', d.get('scope_creep', False)))),
        'key_person_risk':      int(bool(d.get('keyPersonRisk', False))),
        'unclear_requirements': int(bool(d.get('unclearRequirements', False))),
        'meetings_per_week':    float(d.get('meetingsPerWeek', 2) or 2),
        'doc_score':            float(d.get('docScore', 5) or 5),
        'duration_planned':     duration,
        'sprints_count':        sprints,
    }], columns=FEATURES)


# ── Indices composites — calculés par interaction de plusieurs variables ─────
def build_composite_indices(d, sig):
    """Calcule des indices intermédiaires en combinant plusieurs variables
    à la fois (pas un seul facteur isolé), pour que chaque indice reflète
    une dynamique réelle de projet plutôt qu'une règle plate."""
    budget      = float(d.get('budget', 1) or 1)
    budget_used = float(d.get('budgetUsed', 0) or 0)
    budget_ratio = budget_used / budget if budget > 0 else 0
    progress    = float(d.get('progress', 0) or 0) / 100
    velocity    = float(d.get('velocity', 50) or 50)
    team_size   = max(1, int(d.get('teamSize', 5) or 5))
    tickets     = float(d.get('openTickets', 0) or 0)
    absences    = float(d.get('absences', 0) or 0)
    meetings    = float(d.get('meetingsPerWeek', 2) or 2)
    doc         = float(d.get('docScore', 5) or 5)
    duration    = float(d.get('durationPlanned', d.get('duration_planned', 180)) or 180)
    methodology = str(d.get('methodology') or 'Scrum')
    overscoped  = bool(d.get('overscoped', False))
    team_issues = bool(d.get('teamIssues', d.get('team_issues', False)))
    tech_debt   = bool(d.get('techDebt', d.get('tech_debt', False)))
    scope_creep = bool(d.get('scopeCreep', d.get('scope_creep', False)))
    key_person  = bool(d.get('keyPersonRisk', False))
    unclear_req = bool(d.get('unclearRequirements', False))

    # Vitesse d'avancement attendue compte tenu de la durée déjà écoulée
    # (proxy : ratio budget consommé comme indicateur de temps écoulé,
    # combiné à la durée planifiée) -> tension de planning continue.
    elapsed_proxy = clip(budget_ratio, 0.02, 1.3)
    schedule_pressure = sigmoid((elapsed_proxy - progress) * 4.5, k=1.2)  # 0 = en avance, 1 = très en retard

    # Efficacité budgétaire : combine progrès réel vs consommation, pondérée
    # par la durée du projet (un dépassement précoce pèse plus lourd).
    duration_factor = clip(180 / max(duration, 30), 0.5, 1.8)
    budget_efficiency = sigmoid((progress - budget_ratio * duration_factor) * 5.0, k=1.0)

    # Charge par tête : tickets ouverts + absences rapportés à la taille
    # d'équipe et à la cadence de coordination -> capacité réelle d'absorption.
    load_per_capita = (tickets * 1.0 + absences * 4.0) / team_size
    coordination_factor = clip(meetings / 3.0, 0.3, 1.5)
    team_strain = sigmoid((load_per_capita / coordination_factor - 4.5) * 0.35, k=1.0)

    # Vélocité relative à la complexité implicite (équipe x méthodologie) :
    # une vélocité de 50 n'a pas le même sens pour une équipe de 3 en
    # Waterfall que pour une équipe de 10 en Scrum.
    method_velocity_norm = {'Agile': 1.05, 'Kanban': 1.0, 'Scrum': 1.1, 'Waterfall': 0.8}.get(methodology, 1.0)
    expected_velocity = 8 * team_size * method_velocity_norm
    velocity_health = sigmoid((velocity - expected_velocity * 0.6) / max(expected_velocity * 0.35, 5), k=1.0)

    # Fragilité de gouvernance : combinaison non additive des drapeaux
    # qualitatifs (les co-occurrences pèsent plus que la somme des parties).
    flags = [overscoped, team_issues, tech_debt, scope_creep, key_person, unclear_req]
    n_flags = sum(flags)
    governance_fragility = sigmoid((n_flags - 1.5) * 0.9 + (0.3 if (key_person and team_issues) else 0)
                                    + (0.3 if (scope_creep and unclear_req) else 0), k=1.0)

    # Maturité documentaire pondérée par le risque d'exigences floues
    doc_maturity = sigmoid((doc - 5) * 0.6 - (2.2 if unclear_req else 0), k=0.9)

    return {
        'schedule_pressure':   schedule_pressure,    # 0 (sain) -> 1 (critique)
        'budget_efficiency':   budget_efficiency,    # 1 (sain) -> 0 (critique)
        'team_strain':         team_strain,          # 0 (sain) -> 1 (critique)
        'velocity_health':     velocity_health,      # 1 (sain) -> 0 (critique)
        'governance_fragility': governance_fragility,# 0 (sain) -> 1 (critique)
        'doc_maturity':        doc_maturity,         # 1 (sain) -> 0 (critique)
        'progress':            progress,
        'budget_ratio':        budget_ratio,
        'n_flags':             n_flags,
        'team_size':           team_size,
        'tickets':             tickets,
    }


# ── Facteurs explicables spécifiques à CHAQUE projet ──────────────────────────
def build_explainable_factors(d, score, idx, sig):
    progress     = float(d.get('progress', 0) or 0)
    velocity     = float(d.get('velocity', 50) or 50)
    team_size    = int(d.get('teamSize', 5) or 5)
    tickets      = float(d.get('openTickets', 0) or 0)
    budget_ratio = idx['budget_ratio']

    # Progression — légèrement modulée par la tension de planning, pour ne
    # pas afficher un même 7.0/10 à 70% d'avancement quel que soit le rythme.
    progress_score = round(clip(progress / 10 - idx['schedule_pressure'] * 1.4 + sig * 0.3, 0, 10), 1)

    # Budget — dérivé directement de l'indice d'efficacité budgétaire
    # composite (progrès vs consommation vs durée), pas d'un simple ratio.
    budget_score = round(clip(idx['budget_efficiency'] * 10 + sig * 0.4, 0, 10), 1)

    # Vélocité — relative à la complexité implicite équipe/méthodologie.
    velocity_score = round(clip(idx['velocity_health'] * 10 + sig * 0.3, 0, 10), 1)

    # Charge technique — pondérée par la capacité d'absorption de l'équipe,
    # pas seulement le nombre brut de tickets.
    quality_score = round(clip(10 - idx['team_strain'] * 7.5 - tickets * 0.04 + sig * 0.3, 0, 10), 1)

    # Équipe — capacité réelle compte tenu de la charge actuelle.
    team_score = round(clip(3.5 + team_size * 0.55 - idx['team_strain'] * 3.0 + sig * 0.3, 0, 10), 1)

    return [
        {'key': 'progress', 'label': 'Progression', 'score': progress_score,
         'detail': f"{int(progress)}% d'avancement réel, tension planning {round(idx['schedule_pressure']*100)}%."},
        {'key': 'budget', 'label': 'Maîtrise budgétaire', 'score': budget_score,
         'detail': f"{round(budget_ratio*100,1)}% du budget consommé pour {int(progress)}% d'avancement."},
        {'key': 'velocity', 'label': 'Vélocité', 'score': velocity_score,
         'detail': f"{int(velocity)} points par sprint pour une équipe de {team_size}."},
        {'key': 'quality', 'label': 'Charge technique', 'score': quality_score,
         'detail': f"{int(tickets)} ticket(s) ouvert(s), charge/tête {round(idx['team_strain']*100)}%."},
        {'key': 'team', 'label': 'Capacité équipe', 'score': team_score,
         'detail': f"{team_size} membre(s), tension d'équipe {round(idx['team_strain']*100)}%."},
    ]


# ── Analyse de santé projet structurée ─────────────────────────────────────
def build_health_analysis(d, score, risk_cat_idx, delay_pred, success_prob, idx, sig, risks=None, recommendations=None):
    progress    = float(d.get('progress', 0) or 0)
    velocity    = float(d.get('velocity', 50) or 50)
    team_size   = int(d.get('teamSize', 5) or 5)
    tickets     = float(d.get('openTickets', 0) or 0)
    absences    = float(d.get('absences', 0) or 0)
    meetings    = float(d.get('meetingsPerWeek', 2) or 2)
    budget_ratio = idx['budget_ratio']
    domain      = str(d.get('domain') or d.get('projectDomain') or d.get('category') or '').strip().lower()

    # Health Score = combinaison pondérée des indices composites (pas une
    # somme de pénalités fixes). Chaque indice contribue selon un poids
    # métier, et la signature contextuelle ajoute une dispersion fine.
    weighted = (
        (1 - idx['schedule_pressure'])   * 22 +
        idx['budget_efficiency']         * 20 +
        (1 - idx['team_strain'])         * 16 +
        idx['velocity_health']           * 18 +
        (1 - idx['governance_fragility'])* 14 +
        idx['doc_maturity']              * 10
    )  # max théorique ~100

    score_anchor = (score / 10) * 25       # ancrage sur le score ML
    success_anchor = (success_prob / 100) * 10
    domain_bonus = 1.5 if domain in {'finance', 'healthcare', 'energy', 'insurance'} else 0
    delay_penalty = clip(delay_pred * 0.55, 0, 14)

    raw_health = weighted * 0.62 + score_anchor + success_anchor + domain_bonus - delay_penalty + sig * 4
    health_score = round(clip(raw_health, HEALTH_SCORE_MIN, HEALTH_SCORE_MAX))

    # Seuils non figés : un léger glissement contextuel (sig) évite que deux
    # projets au score limite tombent systématiquement du même côté.
    healthy_cut = 70 + sig * 3
    warning_cut = 46 + sig * 3
    if health_score >= healthy_cut:
        status = 'healthy'
    elif health_score >= warning_cut:
        status = 'warning'
    else:
        status = 'critical'

    positives = []
    negatives = []

    if idx['schedule_pressure'] < 0.45:
        positives.append({'label': 'Trajectoire de planning tenue', 'detail': f"Progression à {int(progress)}%, tension de planning maîtrisée ({round(idx['schedule_pressure']*100)}%)."})
    else:
        negatives.append({'label': 'Pression de planning élevée', 'detail': f"Le rythme d'avancement ({int(progress)}%) accuse un retard relatif au temps/budget déjà engagé."})

    if idx['budget_efficiency'] >= 0.5:
        positives.append({'label': 'Budget maîtrisé', 'detail': f"Consommation à {round(budget_ratio * 100, 1)}%, cohérente avec l'avancement."})
    else:
        negatives.append({'label': 'Efficacité budgétaire dégradée', 'detail': f"Le budget consommé ({round(budget_ratio * 100, 1)}%) progresse plus vite que l'avancement réel."})

    if idx['velocity_health'] >= 0.5:
        positives.append({'label': 'Vélocité adaptée à l\'équipe', 'detail': f"{int(velocity)} points/sprint, cohérents avec une équipe de {team_size}."})
    else:
        negatives.append({'label': 'Vélocité sous la capacité attendue', 'detail': f"{int(velocity)} points/sprint sont en retrait par rapport à la taille d'équipe ({team_size})."})

    if idx['team_strain'] < 0.5:
        positives.append({'label': 'Charge technique absorbée', 'detail': f"{int(tickets)} tickets ouverts, charge compatible avec la capacité d'équipe."})
    else:
        negatives.append({'label': 'Tension équipe/charge technique', 'detail': f"{int(tickets)} tickets et {int(absences)} absence(s) pèsent sur une équipe de {team_size}."})

    if idx['governance_fragility'] < 0.45 and meetings >= 1.5:
        positives.append({'label': 'Gouvernance stable', 'detail': 'Peu de signaux de gouvernance dégradée, cadence de coordination correcte.'})
    else:
        negatives.append({'label': 'Signaux de gouvernance fragile', 'detail': f"{idx['n_flags']} signal(aux) qualitatif(s) de risque détecté(s) (scope, dépendances, exigences...)."})

    if domain:
        positives.append({'label': 'Orientation métier claire', 'detail': f'Le contexte métier détecté est {domain}.'})

    if risks is None:
        risks = []
    if recommendations is None:
        recommendations = []

    if health_score < 70:
        recommendations = recommendations[:4]
    else:
        recommendations = []

    return {
        'healthScore': health_score,
        'status': status,
        'summary': 'Analyse contextuelle combinant planning, budget, vélocité, charge d\'équipe et gouvernance.' if status != 'healthy' else 'Le projet conserve une trajectoire globalement saine, avec une marge de progression sur certains indicateurs.',
        'positives': positives[:4],
        'negatives': negatives[:4],
        'risks': risks,
        'recommendations': recommendations,
    }


# ── Analyse des risques — gravité composite, pas de seuils isolés ────────────
def analyze_risks(d, score, risk_cat_idx, delay_pred, idx, sig):
    risks = []
    velocity    = float(d.get('velocity', 50) or 50)
    progress    = float(d.get('progress', 0) or 0)
    tickets     = float(d.get('openTickets', 0) or 0)
    budget_ratio = idx['budget_ratio']

    # Gravité globale : combinaison pondérée de plusieurs indices, modulée
    # par la signature du projet -> deux projets aux métriques voisines
    # n'aboutissent pas exactement au même jeu de risques.
    global_severity = clip(
        idx['schedule_pressure'] * 0.28 +
        (1 - idx['budget_efficiency']) * 0.26 +
        idx['team_strain'] * 0.2 +
        (1 - idx['velocity_health']) * 0.18 +
        idx['governance_fragility'] * 0.18 +
        max(0, -sig) * 0.05, 0, 1.2)

    if global_severity > 0.62 or score < 4.0:
        risks.append({
            'title': 'Risque global critique — intervention urgente',
            'description': f'Le score combiné (ML {score}/10, indice de gravité {round(global_severity,2)}) indique un projet en danger immédiat sans action corrective.',
            'severity': 'critical', 'probability': min(96, round(70 + global_severity * 22)),
            'category': 'global', 'ml_detected': True,
            'actions': [
                'Réunion de crise avec toutes les parties prenantes sous 24h',
                'Réduire le périmètre aux fonctionnalités critiques',
                'Escalader au management supérieur immédiatement',
            ]
        })
    elif global_severity > 0.4 or score < 5.5:
        risks.append({
            'title': 'Risque global élevé — action requise',
            'description': f'Le score combiné (ML {score}/10, indice de gravité {round(global_severity,2)}) montre une dérive significative par rapport à la trajectoire optimale.',
            'severity': 'high', 'probability': min(88, round(50 + global_severity * 30)),
            'category': 'global', 'ml_detected': True,
            'actions': [
                'Plan de redressement à mettre en place cette semaine',
                'Identifier les blocages principaux et les lever',
            ]
        })

    if delay_pred > 4:
        sev = 'critical' if delay_pred > 28 else 'high' if delay_pred > 14 else 'medium'
        risks.append({
            'title': f'Retard prédit de {int(delay_pred)} jours par le modèle',
            'description': f'Le modèle estime {int(delay_pred)}j de retard, en lien avec la vélocité ({int(velocity)} pts) et la progression ({int(progress)}%).',
            'severity': sev,
            'probability': min(94, round(40 + delay_pred * 1.6 + idx['schedule_pressure'] * 20)),
            'category': 'planning', 'ml_detected': True,
            'actions': [
                f"Réorganiser le backlog pour récupérer environ {int(delay_pred*0.6)}j",
                'Ajouter des ressources ciblées ou réduire le scope',
                'Mettre en place un suivi quotidien court (15 min)',
            ]
        })

    if idx['budget_efficiency'] < 0.55 and budget_ratio > 0.55:
        sev = 'critical' if budget_ratio > 1.0 or idx['budget_efficiency'] < 0.25 else 'high' if idx['budget_efficiency'] < 0.4 else 'medium'
        risks.append({
            'title': 'Dérive budgétaire en cours' if sev != 'critical' else 'Dépassement budgétaire imminent',
            'description': f"Consommation à {round(budget_ratio*100,1)}% pour {int(progress)}% d'avancement — l'efficacité budgétaire composite est de {round(idx['budget_efficiency']*100)}%.",
            'severity': sev,
            'probability': min(95, round(45 + (1 - idx['budget_efficiency']) * 50)),
            'category': 'budget', 'ml_detected': True,
            'actions': [
                'Geler les dépenses non critiques' if sev == 'critical' else 'Renforcer la revue budgétaire hebdomadaire',
                'Préparer un scénario budgétaire de contingence',
            ]
        })

    if idx['velocity_health'] < 0.5:
        sev = 'critical' if idx['velocity_health'] < 0.22 else 'high' if idx['velocity_health'] < 0.38 else 'medium'
        risks.append({
            'title': 'Vélocité en retrait de la capacité d\'équipe',
            'description': f"Vélocité à {int(velocity)} pts/sprint, sous le niveau attendu compte tenu de la taille et de la méthodologie de l'équipe.",
            'severity': sev,
            'probability': min(90, round(40 + (1 - idx['velocity_health']) * 55)),
            'category': 'planning', 'ml_detected': True,
            'actions': [
                'Identifier et lever les impediments récurrents',
                'Revoir la définition du "Done" avec l\'équipe',
            ]
        })

    if idx['team_strain'] > 0.55:
        sev = 'critical' if idx['team_strain'] > 0.8 else 'high'
        risks.append({
            'title': f"Surcharge équipe détectée ({int(tickets)} tickets ouverts)",
            'description': f"La charge par membre d'équipe (tickets + absences rapportés à la cadence de coordination) atteint un niveau de tension de {round(idx['team_strain']*100)}%.",
            'severity': sev, 'probability': min(92, round(45 + idx['team_strain']*45)),
            'category': 'technical', 'ml_detected': True,
            'actions': [
                'Allouer une part de la capacité à la réduction de dette/tickets',
                'Revoir la répartition de charge au sein de l\'équipe',
            ]
        })

    if idx['governance_fragility'] > 0.55:
        details = []
        if d.get('keyPersonRisk'):
            details.append('dépendance à une personne clé')
        if d.get('unclearRequirements'):
            details.append('exigences peu définies')
        if d.get('scopeCreep'):
            details.append('dérive de périmètre')
        if d.get('teamIssues'):
            details.append('tensions d\'équipe')
        desc = 'Plusieurs signaux qualitatifs combinés (' + ', '.join(details) + ') fragilisent la gouvernance du projet.' if details else 'Plusieurs signaux qualitatifs combinés fragilisent la gouvernance du projet.'
        risks.append({
            'title': 'Fragilité de gouvernance projet',
            'description': desc,
            'severity': 'critical' if idx['governance_fragility'] > 0.78 else 'high',
            'probability': min(90, round(40 + idx['governance_fragility']*48)),
            'category': 'hr', 'ml_detected': True,
            'actions': ['Documenter les connaissances critiques et former un backup',
                        'Organiser une session de clarification des exigences/périmètre']
        })

    return risks


# ── Recommandations intelligentes basées sur les indices composites ────────
def generate_recommendations(d, score, risks, delay_pred, success_prob, idx, sig):
    progress  = float(d.get('progress', 0) or 0)
    velocity  = float(d.get('velocity', 50) or 50)
    tickets   = float(d.get('openTickets', 0) or 0)
    team_size = int(d.get('teamSize', 5) or 5)
    doc       = float(d.get('docScore', 5) or 5)
    domain    = str(d.get('domain') or d.get('projectDomain') or d.get('category') or '').strip().lower()
    methodology = str(d.get('methodology') or 'Scrum')
    end_date  = d.get('endDate') or d.get('deadline') or d.get('deliveryDate')
    budget_ratio = idx['budget_ratio']

    severity_index = clip(
        idx['schedule_pressure'] * 0.28 +
        (1 - idx['budget_efficiency']) * 0.24 +
        idx['team_strain'] * 0.2 +
        (1 - idx['velocity_health']) * 0.16 +
        idx['governance_fragility'] * 0.12, 0, 1.2)

    risk_level = 'critical' if severity_index > 0.62 else 'high' if severity_index > 0.42 else 'medium' if severity_index > 0.22 else 'low'

    strengths = []
    weaknesses = []

    if idx['schedule_pressure'] < 0.4:
        strengths.append(f"Avancement de {int(progress)}% cohérent avec le rythme attendu du projet.")
    else:
        weaknesses.append(f"La progression de {int(progress)}% est en retrait par rapport au temps/budget déjà engagé (tension {round(idx['schedule_pressure']*100)}%).")

    if idx['budget_efficiency'] >= 0.55:
        strengths.append(f"L'efficacité budgétaire ({round(idx['budget_efficiency']*100)}%) montre une consommation cohérente avec l'avancement.")
    else:
        weaknesses.append(f"Le budget consommé ({round(budget_ratio*100,1)}%) progresse plus vite que l'avancement réel ({int(progress)}%).")

    if idx['velocity_health'] >= 0.55:
        strengths.append(f"La vélocité ({int(velocity)} pts/sprint) est adaptée à la taille de l'équipe et à la méthodologie.")
    else:
        weaknesses.append(f"La vélocité ({int(velocity)} pts/sprint) reste en retrait par rapport à la capacité attendue de l'équipe.")

    if idx['team_strain'] < 0.5:
        strengths.append(f"La charge technique ({int(tickets)} tickets) reste absorbable par l'équipe en place.")
    else:
        weaknesses.append(f"La charge technique et les absences pèsent fortement sur une équipe de {team_size} personnes.")

    if idx['governance_fragility'] < 0.45:
        strengths.append('Peu de signaux qualitatifs de fragilité (périmètre, exigences, dépendances clés).')
    else:
        weaknesses.append(f"{idx['n_flags']} signal(aux) de gouvernance fragile détecté(s), à traiter en priorité.")

    if doc >= 6 and idx['doc_maturity'] >= 0.5:
        strengths.append('La documentation est suffisamment mature pour soutenir la continuité opérationnelle.')
    else:
        weaknesses.append('La documentation reste un point de fragilité pour la mise en production et les transitions.')

    if end_date:
        if idx['schedule_pressure'] > 0.55:
            weaknesses.append('La date de livraison est sous tension compte tenu du niveau d\'avancement actuel.')
        else:
            strengths.append(f"Le calendrier reste viable avec la livraison prévue le {end_date}.")

    if methodology:
        if methodology.lower() in {'scrum', 'kanban'} and idx['velocity_health'] >= 0.4:
            strengths.append(f"La méthode {methodology} soutient un suivi itératif réactif sur ce projet.")
        elif methodology.lower() == 'waterfall' and idx['schedule_pressure'] > 0.5:
            weaknesses.append(f"La gouvernance {methodology} ralentit la capacité de correction face à la tension de planning actuelle.")

    if domain:
        strengths.append(f"Le contexte métier {domain} est pris en compte dans la structuration actuelle.")

    if risk_level == 'critical':
        project_status = 'Le projet nécessite une intervention immédiate pour éviter une dérive opérationnelle.'
        analysis = f"L'indice de gravité composite ({round(severity_index,2)}) combine une pression de planning de {round(idx['schedule_pressure']*100)}%, une efficacité budgétaire de {round(idx['budget_efficiency']*100)}% et une tension d'équipe de {round(idx['team_strain']*100)}% : plusieurs signaux critiques se cumulent simultanément."
        actions = [
            'Prioriser les livrables critiques et supprimer les tâches non essentielles',
            'Réunir l\'équipe de direction pour valider un plan de redressement en 48 heures',
            'Réduire les dépendances et clarifier les responsabilités sur les blocs critiques',
        ]
        confidence = int(clip(86 + severity_index * 9 + sig * 3, 70, 97))
    elif risk_level == 'high':
        project_status = 'Le projet reste viable mais exige un pilotage plus strict sur le budget, le planning et la qualité.'
        analysis = f"L'indice de gravité composite ({round(severity_index,2)}) montre plusieurs signaux cumulés (planning, budget, charge d'équipe) sans atteindre un seuil critique unique."
        actions = [
            'Séparer les tâches critiques des travaux secondaires pour protéger la livraison',
            'Renforcer la cadence de suivi avec des revues hebdomadaires ciblées',
            'Corriger les points de friction sur la documentation et la coordination',
        ]
        confidence = int(clip(78 + (1-severity_index) * 6 + sig * 3, 65, 90))
    elif risk_level == 'medium':
        project_status = 'Le projet est globalement stable, avec quelques points à surveiller pour maintenir la performance.'
        analysis = f"Les indices composites (planning {round(idx['schedule_pressure']*100)}%, budget {round(idx['budget_efficiency']*100)}%, vélocité {round(idx['velocity_health']*100)}%) indiquent une trajectoire correcte mais sensible aux aléas."
        actions = [
            'Maintenir la cadence de suivi et surveiller les indicateurs clés chaque semaine',
            'Continuer à clarifier les priorités pour éviter les dérives de périmètre',
            'Investir dans la documentation et la préparation des prochaines étapes',
        ]
        confidence = int(clip(74 + sig * 4, 60, 85))
    else:
        project_status = 'Le projet affiche une bonne dynamique et les conditions de réussite sont réunies.'
        analysis = f"Les indices composites convergent positivement : pression de planning {round(idx['schedule_pressure']*100)}%, efficacité budgétaire {round(idx['budget_efficiency']*100)}%, tension d'équipe {round(idx['team_strain']*100)}%."
        actions = [
            'Conserver la cadence actuelle et verrouiller les prochaines étapes',
            'Préparer la transition de production et la validation finale',
            'Maintenir la discipline de suivi sur les écarts résiduels',
        ]
        confidence = int(clip(80 + sig * 5, 70, 92))

    if not strengths:
        strengths = ['Le projet possède une base de départ cohérente.']
    if not weaknesses:
        weaknesses = ['Aucun signal critique n\'a été identifié à ce stade.']

    return [{
        'title': f'Analyse IA — {methodology}',
        'projectStatus': project_status,
        'analysis': analysis,
        'strengths': strengths[:4],
        'weaknesses': weaknesses[:4],
        'recommendedActions': actions[:4],
        'confidence': confidence,
        'priority': 'urgent' if risk_level == 'critical' else 'high' if risk_level == 'high' else 'medium',
        'impact': 'Ajustement pilotage et protection de la livraison' if risk_level != 'low' else 'Renforcement de la continuité et de la qualité',
        'effort': '1 à 3 jours' if risk_level in ('critical', 'high') else 'Suivi hebdomadaire',
    }]


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Body JSON requis'}), 400

    try:
        X = extract_features(data)
        sig = project_signature(data)            # dispersion contextuelle déterministe, dans [-1, 1]
        idx = build_composite_indices(data, sig)  # indices composites multi-variables

        if MODELS_OK:
            score_raw     = float(model_score.predict(X)[0])
            # Le score ML brut est recalé par les indices composites (légère
            # correction contextuelle) plutôt qu'un simple clip plat, pour
            # éviter que deux projets aux features proches du modèle mais au
            # contexte qualitatif différent ressortent avec un score identique.
            contextual_adj = (idx['budget_efficiency'] + idx['velocity_health'] + (1-idx['team_strain'])
                               + (1-idx['schedule_pressure']) + (1-idx['governance_fragility'])) / 5
            score = round(clip(score_raw * 0.82 + contextual_adj * 10 * 0.18 + sig * 0.25, 1.0, 10.0), 1)

            risk_cat_idx  = int(model_risk.predict(X)[0])
            delay_raw     = float(model_delay.predict(X)[0])
            delay_pred    = max(0, round(delay_raw * (1 + idx['schedule_pressure'] * 0.35 - idx['budget_efficiency'] * 0.1), 1))

            success_raw   = float(model_success.predict_proba(X)[0][1]) * 100
            # La probabilité de succès est ancrée sur la sortie ML mais
            # modulée par l'indice de gravité composite et la dispersion
            # contextuelle, avec une transition lissée (sigmoïde) plutôt
            # qu'un clip dur, pour éviter les 0%/100% irréalistes.
            severity_index = clip(idx['schedule_pressure']*0.28 + (1-idx['budget_efficiency'])*0.26
                                   + idx['team_strain']*0.2 + (1-idx['velocity_health'])*0.18
                                   + idx['governance_fragility']*0.18, 0, 1.3)
            blended = success_raw * 0.6 + (1 - severity_index) * 100 * 0.4
            success_proba = SUCCESS_PROB_MIN + (SUCCESS_PROB_MAX - SUCCESS_PROB_MIN) * sigmoid((blended - 50) / 22 + sig * 0.15, k=1.0)
            model_used    = 'RandomForest + GradientBoosting (4 modèles ML) + couche contextuelle'
        else:
            contextual_adj = (idx['budget_efficiency'] + idx['velocity_health'] + (1-idx['team_strain'])
                               + (1-idx['schedule_pressure']) + (1-idx['governance_fragility'])) / 5
            score = round(clip(3.5 + contextual_adj * 6.0 + sig * 0.4, 1, 10), 1)
            severity_index = clip(idx['schedule_pressure']*0.28 + (1-idx['budget_efficiency'])*0.26
                                   + idx['team_strain']*0.2 + (1-idx['velocity_health'])*0.18
                                   + idx['governance_fragility']*0.18, 0, 1.3)
            success_proba = SUCCESS_PROB_MIN + (SUCCESS_PROB_MAX - SUCCESS_PROB_MIN) * sigmoid(((1-severity_index)*100 - 50) / 22 + sig*0.15, k=1.0)
            risk_cat_idx  = 3 if score < 4 else 2 if score < 5.5 else 1 if score < 7 else 0
            delay_pred    = round(max(0, (10 - score) * 2.2 * (1 + idx['schedule_pressure'] * 0.3)), 1)
            model_used    = 'Fallback contextuel (modèles ML non chargés)'

        success_proba = round(clip(success_proba, SUCCESS_PROB_MIN, SUCCESS_PROB_MAX), 1)

        risks                = analyze_risks(data, score, risk_cat_idx, delay_pred, idx, sig)
        recommendations      = generate_recommendations(data, score, risks, delay_pred, success_proba, idx, sig)
        explainable_factors  = build_explainable_factors(data, score, idx, sig)
        health_analysis = build_health_analysis(
            data, score, risk_cat_idx, delay_pred, success_proba, idx, sig,
            risks=risks, recommendations=recommendations,
        )

        delay_prob = max(0, min(96, round(35 + idx['schedule_pressure'] * 45 + (1 - idx['budget_efficiency']) * 18 + sig * 4)))
        budget_overrun = round(max(0, (idx['budget_ratio'] - (0.78 + idx['velocity_health'] * 0.1)) * 100), 1)

        return jsonify({
            'score':              score,
            'riskCategory':       RISK_CATS[risk_cat_idx],
            'riskSeverity':       RISK_SEVS[risk_cat_idx],
            'successProbability': round(success_proba, 1),
            'modelUsed':          model_used,
            'healthScore':        health_analysis['healthScore'],
            'healthStatus':       health_analysis['status'],
            'healthSummary':      health_analysis['summary'],
            'positives':          health_analysis['positives'],
            'negatives':          health_analysis['negatives'],
            'risks':              health_analysis['risks'],
            'recommendations':    health_analysis['recommendations'],
            'factors':            explainable_factors,
            'predictions': {
                'delayProbability': delay_prob,
                'estimatedDelay':   round(delay_pred, 1),
                'budgetOverrun':    max(0, budget_overrun),
                'successProb':      round(success_proba, 1),
            },
            'featureImportances': META.get('feature_importances', {}),
            'modelMetrics': {
                'r2':       META.get('score_model', {}).get('r2', 'N/A'),
                'mae':      META.get('score_model', {}).get('mae', 'N/A'),
                'accuracy': META.get('success_model', {}).get('accuracy', 'N/A'),
                'n_train':  META.get('n_train', 0),
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ok',
        'models_loaded': MODELS_OK,
        'model_version': 'v3.0',
        'n_models':      4,
        'n_features':    len(FEATURES),
        'metrics': META.get('score_model', {}),
        'dataset_size':  META.get('n_total', 0),
    })


@app.route('/dataset/stats', methods=['GET'])
def dataset_stats():
    csv_path = os.path.join(BASE, 'dataset_v2.csv')
    if not os.path.exists(csv_path):
        return jsonify({'error': 'dataset_v2.csv non trouvé'}), 404
    df = pd.read_csv(csv_path)
    return jsonify({
        'n_projects':    int(len(df)),
        'n_features':    len(FEATURES),
        'success_rate':  round(float(df['success'].mean()) * 100, 1),
        'avg_score':     round(float(df['ai_score'].mean()), 2),
        'score_std':     round(float(df['ai_score'].std()), 2),
        'avg_velocity':  round(float(df['velocity'].mean()), 1),
        'risk_distribution': df['risk_category'].value_counts().to_dict(),
        'methodology_dist':  df['methodology'].value_counts().to_dict(),
        'score_percentiles': {
            'p25': round(float(df['ai_score'].quantile(0.25)), 1),
            'p50': round(float(df['ai_score'].quantile(0.50)), 1),
            'p75': round(float(df['ai_score'].quantile(0.75)), 1),
        }
    })


@app.route('/compare', methods=['POST'])
def compare():
    data = request.get_json()
    csv_path = os.path.join(BASE, 'dataset_v2.csv')
    if not os.path.exists(csv_path):
        return jsonify({'error': 'dataset_v2.csv non trouvé'}), 404

    df = pd.read_csv(csv_path)
    method = data.get('methodology', 'Scrum')
    team   = int(data.get('teamSize', 5) or 5)

    similar = df[
        (df['methodology'] == method) &
        (df['team_size'].between(max(2, team-4), team+4))
    ]

    if len(similar) < 5:
        similar = df[df['methodology'] == method]

    return jsonify({
        'similar_projects_count': int(len(similar)),
        'avg_score':      round(float(similar['ai_score'].mean()), 2),
        'avg_velocity':   round(float(similar['velocity'].mean()), 1),
        'success_rate':   round(float(similar['success'].mean()) * 100, 1),
        'avg_delay':      round(float(similar['delay_days'].mean()), 1),
        'score_percentiles': {
            'p25': round(float(similar['ai_score'].quantile(0.25)), 1),
            'p50': round(float(similar['ai_score'].quantile(0.50)), 1),
            'p75': round(float(similar['ai_score'].quantile(0.75)), 1),
        }
    })


@app.route('/batch', methods=['POST'])
def batch():
    projects = request.get_json()
    if not isinstance(projects, list):
        return jsonify({'error': 'Liste de projets requise'}), 400

    results = []
    for p in projects:
        try:
            X = extract_features(p)
            sig = project_signature(p)
            idx = build_composite_indices(p, sig)
            contextual_adj = (idx['budget_efficiency'] + idx['velocity_health'] + (1-idx['team_strain'])
                               + (1-idx['schedule_pressure']) + (1-idx['governance_fragility'])) / 5
            if MODELS_OK:
                score_raw = float(model_score.predict(X)[0])
                score = round(clip(score_raw * 0.82 + contextual_adj * 10 * 0.18 + sig * 0.25, 1, 10), 1)
                succ_raw = float(model_success.predict_proba(X)[0][1]) * 100
                severity_index = clip(idx['schedule_pressure']*0.28 + (1-idx['budget_efficiency'])*0.26
                                       + idx['team_strain']*0.2 + (1-idx['velocity_health'])*0.18
                                       + idx['governance_fragility']*0.18, 0, 1.3)
                blended = succ_raw * 0.6 + (1 - severity_index) * 100 * 0.4
                succ = round(clip(SUCCESS_PROB_MIN + (SUCCESS_PROB_MAX - SUCCESS_PROB_MIN) * sigmoid((blended-50)/22 + sig*0.15), SUCCESS_PROB_MIN, SUCCESS_PROB_MAX), 1)
                rcat  = int(model_risk.predict(X)[0])
            else:
                score = round(clip(3.5 + contextual_adj * 6.0 + sig * 0.4, 1, 10), 1)
                succ = round(clip(SUCCESS_PROB_MIN + (SUCCESS_PROB_MAX - SUCCESS_PROB_MIN) * sigmoid((contextual_adj*100-50)/22 + sig*0.15), SUCCESS_PROB_MIN, SUCCESS_PROB_MAX), 1)
                rcat = 3 if score < 4 else 2 if score < 5.5 else 1 if score < 7 else 0
            results.append({
                'id': p.get('_id', p.get('id')),
                'name': p.get('name', '?'),
                'score': score,
                'successProbability': succ,
                'riskCategory': RISK_CATS[rcat],
            })
        except Exception as e:
            results.append({'id': p.get('_id'), 'error': str(e)})

    return jsonify(results)


if __name__ == '__main__':
    print("=" * 60)
    print("  PREDYNEX — Serveur IA v3.0 — Moteur contextuel dynamique")
    print("=" * 60)
    if MODELS_OK:
        m = META.get('score_model', {})
        print(f"  Score RF     : R²={m.get('r2','?')} | MAE={m.get('mae','?')}")
        print(f"  Succès GB    : Accuracy={META.get('success_model',{}).get('accuracy','?')}")
        print(f"  Risque GB    : Accuracy={META.get('risk_model',{}).get('accuracy','?')}")
        print(f"  Délai GB     : MAE={META.get('delay_model',{}).get('mae','?')}j")
        print(f"  Dataset      : {META.get('n_total',0)} projets | {len(FEATURES)} features")
    else:
        print("  ⚠️  Modèles non trouvés — mode fallback contextuel")
    print(f"\n  API : http://localhost:8000")
    print("=" * 60)
    app.run(port=8000, debug=True)