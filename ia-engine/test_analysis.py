import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import build_health_analysis, generate_recommendations


def test_health_analysis_has_structured_output():
    project = {
        'name': 'Portal CRM',
        'domain': 'Finance',
        'methodology': 'Scrum',
        'budget': 100000,
        'budgetUsed': 86000,
        'progress': 42,
        'velocity': 28,
        'teamSize': 5,
        'openTickets': 35,
        'absences': 2,
        'overscoped': True,
        'keyPersonRisk': True,
        'unclearRequirements': True,
        'meetingsPerWeek': 1,
        'docScore': 3,
    }

    payload = build_health_analysis(project, score=4.2, risk_cat_idx=3, delay_pred=24.5, success_prob=38.2)

    assert payload['healthScore'] >= 0
    assert payload['healthScore'] <= 100
    assert payload['status'] in {'healthy', 'warning', 'critical'}
    assert payload['positives']
    assert payload['negatives']
    assert payload['risks']
    assert payload['recommendations']


def test_contextual_recommendations_follow_expected_structure():
    project = {
        'name': 'Portal CRM',
        'domain': 'Finance',
        'methodology': 'Scrum',
        'budget': 100000,
        'budgetUsed': 86000,
        'progress': 42,
        'velocity': 28,
        'teamSize': 5,
        'openTickets': 35,
        'absences': 2,
        'meetingsPerWeek': 1,
        'docScore': 3,
        'endDate': '2026-10-01',
    }

    recs = generate_recommendations(project, 4.2, [{'severity': 'high'}], 24.5, 38.2)

    assert recs
    assert 'projectStatus' in recs[0]
    assert 'analysis' in recs[0]
    assert 'strengths' in recs[0]
    assert 'weaknesses' in recs[0]
    assert 'recommendedActions' in recs[0]
    assert 'confidence' in recs[0]
