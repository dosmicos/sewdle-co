
import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

// Function to detect browser language
const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language || navigator.languages?.[0];
  const langCode = browserLang?.toLowerCase().split('-')[0];
  
  // Return Spanish if browser language is Spanish, otherwise default to English
  return langCode === 'es' ? 'es' : 'en';
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Check for saved language preference first
    const savedLanguage = localStorage.getItem('sewdle-language') as Language;
    
    if (savedLanguage && ['en', 'es'].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    } else {
      // If no saved preference, detect browser language
      const detectedLanguage = detectBrowserLanguage();
      setLanguageState(detectedLanguage);
      localStorage.setItem('sewdle-language', detectedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sewdle-language', lang);
  };

  const t = (key: string): string => {
    const translations = language === 'es' ? spanishTranslations : englishTranslations;
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

const englishTranslations: Record<string, string> = {
  // Navigation
  'nav.howItWorks': 'How it works',
  'nav.useCases': 'Use cases',
  'nav.pricing': 'Pricing',
  'nav.integrations': 'Integrations',
  'nav.login': 'Sign in',
  'nav.signup': 'Sign up',

  // Hero Section
  'hero.title.1': 'Take total control of your',
  'hero.title.2': 'textile production',
  'hero.subtitle': 'The platform that connects your fashion brand with all your workshops and manufacturers, for limitless management without setbacks.',
  'hero.cta': 'Get started now',

  // Problem Section
  'problem.title': 'Your production is becoming chaotic?',
  'problem.1': 'Orders scattered across emails and spreadsheets.',
  'problem.2': 'Zero real-time visibility of progress.',
  'problem.3': 'Fragmented communication with workshops.',
  'problem.4': 'Scaling = more stress and errors.',

  // Features Section
  'features.title': 'Sewdle in 30 seconds',
  'features.centralized.title': 'Centralized orders',
  'features.centralized.desc': 'Create, assign and track every order from a single panel.',
  'features.connected.title': 'Connected workshops',
  'features.connected.desc': 'Chat and shared timeline; each workshop\'s capacity visible instantly.',
  'features.traceability.title': 'Total traceability',
  'features.traceability.desc': 'Design → supplies → production → delivery, all recorded.',
  'features.dashboard.title': 'Executive dashboard',
  'features.dashboard.desc': 'Progress, compliance and capacity KPIs in real time.',

  // Benefits Section
  'benefits.brands.title': 'For Fashion Brands',
  'benefits.brands.1': '360° visibility of the chain',
  'benefits.brands.2': '30% less time in coordination',
  'benefits.brands.3': 'Decisions based on real data',
  'benefits.brands.4': 'Scale up to 50+ workshops without losing control',
  'benefits.workshops.title': 'For Workshops',
  'benefits.workshops.1': 'Clear and unambiguous orders',
  'benefits.workshops.2': 'Better capacity planning',
  'benefits.workshops.3': 'Direct and fast communication',
  'benefits.workshops.4': 'On-time deliveries, fewer reworks',

  // Use Cases Section
  'useCases.title': 'Use cases',
  'useCases.emerging.title': 'Emerging brand',
  'useCases.emerging.subtitle': '3 → 15 workshops',
  'useCases.emerging.desc': 'Grow without adding more operational staff.',
  'useCases.global.title': 'Global brand',
  'useCases.global.subtitle': '50+ manufacturers in 3 countries',
  'useCases.global.desc': 'Unify reporting and standardize processes.',
  'useCases.seasonal.title': 'Seasonal peaks',
  'useCases.seasonal.subtitle': 'Extra demand',
  'useCases.seasonal.desc': 'Assign extra demand to workshops with free capacity.',

  // Testimonial
  'testimonial': '"With Sewdle we coordinate 12 workshops in an orderly manner and manage returns, imperfections and supplies efficiently."',

  // Differentials Section
  'differentials.title': 'Why choose Sewdle?',
  'differentials.designed.title': '100% designed for fashion',
  'differentials.designed.desc': 'Not a generic ERP.',
  'differentials.shopify.title': 'Native Shopify integration',
  'differentials.shopify.desc': 'Sync inventory and sales in seconds.',
  'differentials.scalable.title': 'Scalable and secure',
  'differentials.scalable.desc': 'Supabase/Postgres infrastructure, TLS 1.3 encryption.',
  'differentials.ui.title': 'UI without learning curve',
  'differentials.ui.desc': 'Your team operates everything in less than 1 day.',

  // Pricing Section
  'pricing.title': 'Transparent plans for every stage',
  'pricing.subtitle': 'Start free and scale as needed',
  'pricing.trial': '14-day free trial on all plans',
  'pricing.starter.title': 'Starter',
  'pricing.starter.subtitle': 'For emerging brands',
  'pricing.starter.price': '$29',
  'pricing.starter.period': '/month',
  'pricing.starter.cta': 'Start free trial',
  'pricing.starter.feature1': 'Up to 10 orders/month',
  'pricing.starter.feature2': '3 users',
  'pricing.starter.feature3': '5 workshops',
  'pricing.starter.feature4': 'Basic inventory management',
  'pricing.starter.feature5': 'Email support',
  'pricing.professional.title': 'Professional',
  'pricing.professional.subtitle': 'For growing brands',
  'pricing.professional.price': '$99',
  'pricing.professional.period': '/month',
  'pricing.professional.popular': 'Most Popular',
  'pricing.professional.cta': 'Start free trial',
  'pricing.professional.feature1': 'Unlimited orders',
  'pricing.professional.feature2': '10 users',
  'pricing.professional.feature3': '20 workshops',
  'pricing.professional.feature4': 'Complete Shopify integration',
  'pricing.professional.feature5': 'Advanced analytics',
  'pricing.professional.feature6': 'Priority support',
  'pricing.enterprise.title': 'Enterprise',
  'pricing.enterprise.subtitle': 'For established brands',
  'pricing.enterprise.price': '$299',
  'pricing.enterprise.period': '/month',
  'pricing.enterprise.cta': 'Start free trial',
  'pricing.enterprise.feature1': 'Everything unlimited',
  'pricing.enterprise.feature2': 'Unlimited users',
  'pricing.enterprise.feature3': 'White-label available',
  'pricing.enterprise.feature4': 'Custom API',
  'pricing.enterprise.feature5': 'Dedicated account manager',
  'pricing.enterprise.feature6': '24/7 support',
  'pricing.faq.title': 'Frequently asked questions',
  'pricing.faq.q1': 'Can I change plans at any time?',
  'pricing.faq.a1': 'Yes, you can upgrade or downgrade your plan whenever needed. Changes are reflected immediately.',
  'pricing.faq.q2': 'What does the free trial include?',
  'pricing.faq.a2': 'Full 14 days with access to all Professional plan features, no restrictions.',
  'pricing.faq.q3': 'Are there setup or implementation costs?',
  'pricing.faq.a3': 'No, all our plans include complete onboarding at no additional cost.',

  // Final CTA Section
  'finalCta.title': 'Start your transformation today',
  'finalCta.subtitle': 'Thousands of brands trust Sewdle to manage their production',
  'finalCta.demo': 'Watch demo',
  'finalCta.start': 'Start free now',

  // Footer
  'footer.rights': '© 2024 Sewdle. All rights reserved.'
};

const spanishTranslations: Record<string, string> = {
  // Navigation
  'nav.howItWorks': 'Cómo funciona',
  'nav.useCases': 'Casos de uso',
  'nav.pricing': 'Precios',
  'nav.integrations': 'Integraciones',
  'nav.login': 'Iniciar sesión',
  'nav.signup': 'Registrarse',

  // Hero Section
  'hero.title.1': 'Toma el control total de tu',
  'hero.title.2': 'producción textil',
  'hero.subtitle': 'La plataforma que conecta tu marca de moda con todos tus talleres y fabricantes, para una gestión sin límites ni sobresaltos.',
  'hero.cta': 'Empezar ahora',

  // Problem Section
  'problem.title': '¿Tu producción se está volviendo caótica?',
  'problem.1': 'Órdenes dispersas en emails y hojas de cálculo.',
  'problem.2': 'Cero visibilidad en tiempo real del avance.',
  'problem.3': 'Comunicación fragmentada con talleres.',
  'problem.4': 'Escalar = más estrés y errores.',

  // Features Section
  'features.title': 'Sewdle en 30 segundos',
  'features.centralized.title': 'Órdenes centralizadas',
  'features.centralized.desc': 'Crea, asigna y sigue cada orden desde un único panel.',
  'features.connected.title': 'Talleres conectados',
  'features.connected.desc': 'Chat y timeline compartido; capacidad de cada taller visible al instante.',
  'features.traceability.title': 'Trazabilidad total',
  'features.traceability.desc': 'Diseño → insumos → producción → entrega, todo registrado.',
  'features.dashboard.title': 'Dashboard ejecutivo',
  'features.dashboard.desc': 'KPIs de avance, cumplimiento y capacidad en tiempo real.',

  // Benefits Section
  'benefits.brands.title': 'Para Marcas de Moda',
  'benefits.brands.1': 'Visibilidad 360° de la cadena',
  'benefits.brands.2': '30% menos tiempo en coordinación',
  'benefits.brands.3': 'Decisiones basadas en datos reales',
  'benefits.brands.4': 'Escala hasta 50+ talleres sin perder control',
  'benefits.workshops.title': 'Para Talleres',
  'benefits.workshops.1': 'Órdenes claras y sin ambigüedades',
  'benefits.workshops.2': 'Mejor planificación de capacidad',
  'benefits.workshops.3': 'Comunicación directa y rápida',
  'benefits.workshops.4': 'Entregas puntuales, menos reprocesos',

  // Use Cases Section
  'useCases.title': 'Casos de uso',
  'useCases.emerging.title': 'Marca emergente',
  'useCases.emerging.subtitle': '3 → 15 talleres',
  'useCases.emerging.desc': 'Crece sin añadir más personal operativo.',
  'useCases.global.title': 'Marca global',
  'useCases.global.subtitle': '50+ fabricantes en 3 países',
  'useCases.global.desc': 'Unifica reporting y estandariza procesos.',
  'useCases.seasonal.title': 'Picos de temporada',
  'useCases.seasonal.subtitle': 'Demanda extra',
  'useCases.seasonal.desc': 'Asigna demanda extra a talleres con capacidad libre.',

  // Testimonial
  'testimonial': '"Con Sewdle coordinamos 12 talleres de manera ordenada y gestionamos devoluciones, imperfectos e insumos de forma eficiente."',

  // Differentials Section
  'differentials.title': '¿Por qué elegir Sewdle?',
  'differentials.designed.title': 'Diseñado 100% para moda',
  'differentials.designed.desc': 'No es un ERP genérico.',
  'differentials.shopify.title': 'Integración Shopify nativa',
  'differentials.shopify.desc': 'Sincroniza inventario y ventas en segundos.',
  'differentials.scalable.title': 'Escalable y seguro',
  'differentials.scalable.desc': 'Infraestructura Supabase/Postgres, cifrado TLS 1.3.',
  'differentials.ui.title': 'UI sin curva de aprendizaje',
  'differentials.ui.desc': 'Tu equipo opera todo en menos de 1 día.',

  // Pricing Section
  'pricing.title': 'Planes transparentes para cada etapa',
  'pricing.subtitle': 'Comienza gratis y escala según tus necesidades',
  'pricing.trial': '14 días de prueba gratis en todos los planes',
  'pricing.starter.title': 'Starter',
  'pricing.starter.subtitle': 'Para marcas emergentes',
  'pricing.starter.price': '$29',
  'pricing.starter.period': '/mes',
  'pricing.starter.cta': 'Comenzar prueba gratis',
  'pricing.starter.feature1': 'Hasta 10 órdenes/mes',
  'pricing.starter.feature2': '3 usuarios',
  'pricing.starter.feature3': '5 talleres',
  'pricing.starter.feature4': 'Gestión básica de inventario',
  'pricing.starter.feature5': 'Soporte por email',
  'pricing.professional.title': 'Professional',
  'pricing.professional.subtitle': 'Para marcas en crecimiento',
  'pricing.professional.price': '$99',
  'pricing.professional.period': '/mes',
  'pricing.professional.popular': 'Más Popular',
  'pricing.professional.cta': 'Comenzar prueba gratis',
  'pricing.professional.feature1': 'Órdenes ilimitadas',
  'pricing.professional.feature2': '10 usuarios',
  'pricing.professional.feature3': '20 talleres',
  'pricing.professional.feature4': 'Integración Shopify completa',
  'pricing.professional.feature5': 'Analytics avanzados',
  'pricing.professional.feature6': 'Soporte prioritario',
  'pricing.enterprise.title': 'Enterprise',
  'pricing.enterprise.subtitle': 'Para marcas establecidas',
  'pricing.enterprise.price': '$299',
  'pricing.enterprise.period': '/mes',
  'pricing.enterprise.cta': 'Comenzar prueba gratis',
  'pricing.enterprise.feature1': 'Todo ilimitado',
  'pricing.enterprise.feature2': 'Usuarios ilimitados',
  'pricing.enterprise.feature3': 'White-label disponible',
  'pricing.enterprise.feature4': 'API personalizada',
  'pricing.enterprise.feature5': 'Gerente de cuenta dedicado',
  'pricing.enterprise.feature6': 'Soporte 24/7',
  'pricing.faq.title': 'Preguntas frecuentes',
  'pricing.faq.q1': '¿Puedo cambiar de plan en cualquier momento?',
  'pricing.faq.a1': 'Sí, puedes actualizar o reducir tu plan cuando lo necesites. Los cambios se reflejan inmediatamente.',
  'pricing.faq.q2': '¿Qué incluye la prueba gratuita?',
  'pricing.faq.a2': '14 días completos con acceso a todas las funciones del plan Professional, sin restricciones.',
  'pricing.faq.q3': '¿Hay costos de setup o implementación?',
  'pricing.faq.a3': 'No, todos nuestros planes incluyen onboarding completo sin costos adicionales.',

  // Final CTA Section
  'finalCta.title': 'Comienza tu transformación hoy',
  'finalCta.subtitle': 'Miles de marcas confían en Sewdle para gestionar su producción',
  'finalCta.demo': 'Ver demo',
  'finalCta.start': 'Empezar gratis ahora',

  // Footer
  'footer.rights': '© 2024 Sewdle. Todos los derechos reservados.'
};
