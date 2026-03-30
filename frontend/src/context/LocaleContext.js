import React, { createContext, useContext, useState } from 'react';

const translations = {
  fr: {
    dashboard: 'Tableau de bord',
    projects: 'Projets',
    analysis: 'Analyse IA',
    risks: 'Risques',
    recommendations: 'Recommandations',
    logout: 'Déconnexion',
    welcome: 'Bonjour',
    overview: 'Vue globale',
    riskMgmt: 'Gestion des risques',
    riskDetail: 'Détails des risques',
    addRisk: 'Ajouter un risque',
    resolve: 'Résoudre',
    ignore: 'Ignorer',
    probability: 'Probabilité',
    recommendationsCount: 'recommandation(s) générée(s)',
    language: 'Langue',
    projectHealth: 'Santé projet',
    plusFeatures: 'Fonctions pro avancées activées',
    aiRecommendations: 'Recommandations IA',
    aiRisks: 'Risques détectés par l\'IA',
    detailedDescription: 'Description détaillée',
    mitigationPlan: 'Plan de mitigation',
    impactEstimated: 'Impact estimé',
    quickActions: 'Actions rapides',
    noData: 'Aucune donnée disponible',
    saved: '✓ Sauvegardé',
  },
  en: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    analysis: 'AI Analysis',
    risks: 'Risks',
    recommendations: 'Recommendations',
    logout: 'Logout',
    welcome: 'Hello',
    overview: 'Overview',
    riskMgmt: 'Risk Management',
    riskDetail: 'Risk Details',
    addRisk: 'Add Risk',
    resolve: 'Resolve',
    ignore: 'Ignore',
    probability: 'Probability',
    recommendationsCount: 'recommendation(s) generated',
    language: 'Language',
    projectHealth: 'Project Health',
    plusFeatures: 'Pro features enabled',
    aiRecommendations: 'AI Recommendations',
    aiRisks: 'AI Detected Risks',
    detailedDescription: 'Detailed description',
    mitigationPlan: 'Mitigation plan',
    impactEstimated: 'Estimated impact',
    quickActions: 'Quick actions',
    noData: 'No data available',
    saved: '✓ Saved',
  },
  ar: {
    dashboard: 'لوحة القيادة',
    projects: 'المشاريع',
    analysis: 'تحليل الذكاء الاصطناعي',
    risks: 'المخاطر',
    recommendations: 'التوصيات',
    logout: 'تسجيل الخروج',
    welcome: 'مرحبًا',
    overview: 'الرؤية العامة',
    riskMgmt: 'إدارة المخاطر',
    riskDetail: 'تفاصيل المخاطر',
    addRisk: 'إضافة مخاطرة',
    resolve: 'حل',
    ignore: 'تجاهل',
    probability: 'الاحتمال',
    recommendationsCount: 'توصية/توصيات تم إنشاؤها',
    language: 'اللغة',
    projectHealth: 'صحة المشروع',
    plusFeatures: 'ميزات المحترفين مفعلة',
    aiRecommendations: 'توصيات الذكاء الاصطناعي',
    aiRisks: 'المخاطر المكتشفة بالذكاء الاصطناعي',
    detailedDescription: 'وصف تفصيلي',
    mitigationPlan: 'خطة التخفيف',
    impactEstimated: 'الأثر المقدر',
    quickActions: 'إجراءات سريعة',
    noData: 'لا توجد بيانات',
    saved: '✓ محفوظ',
  }
};

const LocaleContext = createContext();

export function LocaleProvider({ children }) {
  const defaultLang = localStorage.getItem('lang') || 'fr';
  const [lang, setLangState] = useState(defaultLang);

  const setLang = (nextLang) => {
    setLangState(nextLang);
    localStorage.setItem('lang', nextLang);
  };

  const t = (key, fallback) => {
    return translations[lang]?.[key] || fallback || translations.fr[key] || key;
  };

  const value = { lang, setLang, t };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
