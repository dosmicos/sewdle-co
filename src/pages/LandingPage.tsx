
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import LanguageSelector from '@/components/LanguageSelector';
import MobileNavigation from '@/components/MobileNavigation';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const handleCTAClick = () => {
    navigate('/signup');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Integrated Navigation */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-blue-50"></div>
        
        {/* Navigation Header - Now responsive */}
        <header className="relative z-50 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center flex-shrink-0">
                <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-6 w-auto" />
              </div>

               {/* Desktop Navigation Links */}
               <nav className="hidden md:flex items-center space-x-6">
                 <button onClick={() => scrollToSection('como-funciona')} className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium">
                   {t('nav.howItWorks')}
                 </button>
                 <button onClick={() => scrollToSection('casos-de-uso')} className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium">
                   {t('nav.useCases')}
                 </button>
                 <button onClick={() => scrollToSection('pricing')} className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium">
                   Precios
                 </button>
                 <button onClick={() => scrollToSection('integraciones')} className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium">
                   {t('nav.integrations')}
                 </button>
               </nav>

              {/* Right side items */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Language Selector - always visible */}
                <LanguageSelector />
                
                {/* Desktop Auth Buttons */}
                <div className="hidden md:flex items-center space-x-3">
                  <Button onClick={handleCTAClick} variant="ghost" className="text-sm text-gray-600 hover:text-orange-600 font-medium">
                    {t('nav.login')}
                  </Button>
                  <Button onClick={handleCTAClick} className="bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white text-sm px-4 py-2 rounded-full hover:shadow-lg transition-all duration-300">
                    {t('nav.signup')}
                  </Button>
                </div>

                {/* Mobile Navigation */}
                <MobileNavigation onCTAClick={handleCTAClick} scrollToSection={scrollToSection} />
              </div>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <div className="text-center space-y-6">
            {/* Headline */}
            <div className="space-y-4 max-w-4xl mx-auto">
              <h1 className="text-gray-900 leading-tight text-3xl sm:text-4xl lg:text-6xl font-semibold">
                {t('hero.title.1')}
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
                  {" "}{t('hero.title.2')}
                </span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* CTA */}
            <div className="pt-6">
              <Button onClick={handleCTAClick} className="bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                {t('hero.cta')}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Problem Section - Delphi Style */}
      <motion.section 
        ref={heroRef}
        className="relative py-20 overflow-hidden bg-gradient-radial from-cream-50 via-cream-100 to-cream-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          {/* Mobile Layout */}
          <div className="block md:hidden">
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, type: "spring", stiffness: 50 }}
            >
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-cream-300/30 shadow-lg mx-4">
                <motion.h2 
                  className="text-2xl sm:text-3xl font-bold text-cream-800"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ 
                    duration: 0.5,
                    delay: 0.2,
                    ease: "easeOut"
                  }}
                >
                  {"¿Tu producción se está volviendo caótica?".split("").map((char, index) => (
                    <motion.span
                      key={index}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: 0.3 + index * 0.014,
                        ease: "easeOut"
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </motion.h2>
              </div>
            </motion.div>
            
            {/* Mobile Problem Cards */}
            <div className="space-y-4 px-4">
              {[
                "Órdenes dispersas en emails y hojas de cálculo",
                "Cero visibilidad en tiempo real del avance", 
                "Comunicación fragmentada con talleres",
                "Escalar = más estrés y errores"
              ].map((problem, index) => (
                <motion.div
                  key={index}
                  initial={{ 
                    opacity: 0,
                    x: index % 2 === 0 ? -16 : 16,
                    y: index < 2 ? -16 : 16,
                    filter: "blur(4px)"
                  }}
                  animate={{ 
                    opacity: 1,
                    x: 0,
                    y: 0,
                    filter: "blur(0px)"
                  }}
                  transition={{
                    duration: 0.35,
                    delay: 0.5 + index * 0.08,
                    ease: "easeOut"
                  }}
                  className="bg-white/60 p-4 rounded-xl border border-cream-300/20 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start space-x-3">
                     <motion.div 
                       className="w-3 h-3 bg-orange-500 rounded-full mt-3 flex-shrink-0"
                       animate={{ 
                         scale: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : [1, 1.06, 1]
                       }}
                       transition={{
                         duration: 2.5,
                         repeat: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Infinity,
                         ease: "easeInOut",
                         delay: index * 0.3
                       }}
                       style={{ 
                         filter: "brightness(0.7)",
                         opacity: 0.9
                       }}
                     />
                    <p className="text-sm text-cream-700">{problem}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:block">
            <div className="flex items-center justify-center min-h-[500px] relative">
              {/* Central Title Card */}
              <motion.div
                initial={{ scale: 0.975, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                  duration: 0.45,
                  type: "spring",
                  stiffness: 50,
                  delay: 0.2
                }}
                 style={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? {} : {
                   scale: useTransform(scrollYProgress, [0, 0.2], [1, 0.985]),
                   opacity: useTransform(scrollYProgress, [0, 0.2], [1, 0.92])
                 }}
                className="z-20 max-w-3xl bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-cream-300/30 shadow-xl"
              >
                <h2 className="text-4xl lg:text-5xl font-bold text-center text-cream-800">
                  {"¿Tu producción se está volviendo caótica?".split("").map((char, index) => (
                    <motion.span
                      key={index}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: 0.4 + index * 0.014,
                        ease: "easeOut"
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </h2>
              </motion.div>
              
              {/* Problem Cards positioned in corners */}
              <div className="absolute inset-0">
                {[
                  { 
                    text: "Órdenes dispersas en emails y hojas de cálculo",
                    position: "top-0 left-0",
                    initialX: -16,
                    initialY: -16,
                    delay: 0.6
                  },
                  { 
                    text: "Cero visibilidad en tiempo real del avance",
                    position: "top-0 right-0",
                    initialX: 16,
                    initialY: -16,
                    delay: 0.72
                  },
                  { 
                    text: "Comunicación fragmentada con talleres", 
                    position: "bottom-0 left-0",
                    initialX: -16,
                    initialY: 16,
                    delay: 0.84
                  },
                  { 
                    text: "Escalar = más estrés y errores",
                    position: "bottom-0 right-0", 
                    initialX: 16,
                    initialY: 16,
                    delay: 0.96
                  }
                ].map((problem, index) => {
                  const yOffset = useTransform(
                    scrollYProgress, 
                    [0, 1], 
                    [0, index % 2 === 0 ? -12 : 12]
                  );
                  
                  return (
                    <motion.div
                      key={index}
                      className={`absolute ${problem.position} max-w-xs z-15`}
                      initial={{ 
                        opacity: 0,
                        x: problem.initialX,
                        y: problem.initialY,
                        filter: "blur(4px)"
                      }}
                      animate={{ 
                        opacity: 1,
                        x: 0,
                        y: 0,
                        filter: "blur(0px)"
                      }}
                      transition={{
                        duration: 0.4,
                        delay: problem.delay,
                        ease: "easeOut"
                      }}
                       style={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? {} : {
                         y: yOffset
                       }}
                    >
                       <motion.div 
                         className="bg-white/60 p-6 rounded-xl border border-cream-300/20 hover:shadow-lg transition-all duration-300"
                         animate={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? {} : {
                           y: [0, -2, 0, 2, 0]
                         }}
                         transition={{
                           duration: 6 + Math.random() * 2,
                           repeat: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Infinity,
                           ease: "easeInOut",
                           delay: index * 1.2
                         }}
                       >
                        <div className="flex items-start space-x-3">
                           <motion.div 
                             className="w-4 h-4 bg-orange-500 rounded-full mt-2 flex-shrink-0"
                             animate={{ 
                               scale: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : [1, 1.06, 1]
                             }}
                             transition={{
                               duration: 2.5,
                               repeat: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Infinity,
                               ease: "easeInOut",
                               delay: index * 0.5
                             }}
                             style={{ 
                               filter: "brightness(0.7)",
                               opacity: 0.9
                             }}
                           />
                          <p className="text-base text-cream-700 leading-relaxed">{problem.text}</p>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Features Section - Sewdle en 30s */}
      <section id="como-funciona" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-gray-900 mb-4 font-semibold">
              {t('features.title')}
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              {
                title: t('features.centralized.title'),
                description: t('features.centralized.desc')
              },
              {
                title: t('features.connected.title'),
                description: t('features.connected.desc')
              },
              {
                title: t('features.traceability.title'),
                description: t('features.traceability.desc')
              },
              {
                title: t('features.dashboard.title'),
                description: t('features.dashboard.desc')
              }
            ].map((feature, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow duration-300 border-0 bg-gradient-to-br from-white to-gray-50">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12">
            {/* Para Marcas de Moda */}
            <Card className="p-6 sm:p-8 border-0 shadow-lg bg-white">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{t('benefits.brands.title')}</h3>
              <div className="space-y-4">
                {[t('benefits.brands.1'), t('benefits.brands.2'), t('benefits.brands.3'), t('benefits.brands.4')].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Para Talleres */}
            <Card className="p-6 sm:p-8 border-0 shadow-lg bg-white">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{t('benefits.workshops.title')}</h3>
              <div className="space-y-4">
                {[t('benefits.workshops.1'), t('benefits.workshops.2'), t('benefits.workshops.3'), t('benefits.workshops.4')].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="casos-de-uso" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-gray-900 mb-4 font-semibold">
              {t('useCases.title')}
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                title: t('useCases.emerging.title'),
                subtitle: t('useCases.emerging.subtitle'),
                description: t('useCases.emerging.desc')
              },
              {
                title: t('useCases.global.title'),
                subtitle: t('useCases.global.subtitle'),
                description: t('useCases.global.desc')
              },
              {
                title: t('useCases.seasonal.title'),
                subtitle: t('useCases.seasonal.subtitle'),
                description: t('useCases.seasonal.desc')
              }
            ].map((useCase, index) => (
              <Card key={index} className="p-6 text-center border-0 bg-gradient-to-br from-white to-orange-50 hover:shadow-lg transition-shadow duration-300">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                <p className="text-sm text-orange-600 font-medium mb-4">{useCase.subtitle}</p>
                <p className="text-sm sm:text-base text-gray-600">{useCase.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <blockquote className="text-xl sm:text-2xl lg:text-3xl font-medium text-white leading-relaxed">
            {t('testimonial')}
          </blockquote>
        </div>
      </section>

      {/* Differentials Section */}
      <section id="integraciones" className="py-16 sm:py-20 bg-gradient-to-br from-cream-100 to-cream-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-foreground mb-4 font-semibold">
              {t('differentials.title')}
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {[
              {
                title: t('differentials.designed.title'),
                description: t('differentials.designed.desc')
              },
              {
                title: t('differentials.shopify.title'),
                description: t('differentials.shopify.desc')
              },
              {
                title: t('differentials.scalable.title'),
                description: t('differentials.scalable.desc')
              },
              {
                title: t('differentials.ui.title'),
                description: t('differentials.ui.desc')
              }
            ].map((differential, index) => (
              <div key={index} className="flex items-start space-x-4 p-6 bg-card/50 rounded-xl border border-border/10 hover:shadow-md transition-all duration-300">
                <div className="w-3 h-3 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">{differential.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{differential.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-20 bg-gradient-to-br from-orange-50 via-white to-blue-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Planes transparentes para cada etapa
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Comienza gratis y escala según tus necesidades
            </p>
            <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              14 días de prueba gratis en todos los planes
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <Card className="relative p-6 lg:p-8 border-2 border-gray-200 bg-white rounded-2xl hover:shadow-lg transition-all duration-300">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                <p className="text-gray-600 mb-6">Para marcas emergentes</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-600">/mes</span>
                </div>
                <Button onClick={handleCTAClick} className="w-full bg-gray-900 text-white hover:bg-gray-800 py-3 rounded-xl font-medium transition-all duration-300">
                  Comenzar prueba gratis
                </Button>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Hasta 10 órdenes/mes
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  3 usuarios
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  5 talleres
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Gestión básica de inventario
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Soporte por email
                </div>
              </div>
            </Card>

            {/* Professional Plan - Featured */}
            <Card className="relative p-6 lg:p-8 border-2 border-orange-500 bg-white rounded-2xl shadow-xl transform scale-105 hover:shadow-2xl transition-all duration-300">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Más Popular
                </span>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Professional</h3>
                <p className="text-gray-600 mb-6">Para marcas en crecimiento</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-600">/mes</span>
                </div>
                <Button onClick={handleCTAClick} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg py-3 rounded-xl font-medium transition-all duration-300">
                  Comenzar prueba gratis
                </Button>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Órdenes ilimitadas
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  10 usuarios
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  20 talleres
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Integración Shopify completa
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Analytics avanzados
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Soporte prioritario
                </div>
              </div>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative p-6 lg:p-8 border-2 border-gray-200 bg-white rounded-2xl hover:shadow-lg transition-all duration-300">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <p className="text-gray-600 mb-6">Para marcas establecidas</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$299</span>
                  <span className="text-gray-600">/mes</span>
                </div>
                <Button onClick={handleCTAClick} className="w-full bg-gray-900 text-white hover:bg-gray-800 py-3 rounded-xl font-medium transition-all duration-300">
                  Comenzar prueba gratis
                </Button>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Todo ilimitado
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Usuarios ilimitados
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  White-label disponible
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  API personalizada
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Gerente de cuenta dedicado
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                  Soporte 24/7
                </div>
              </div>
            </Card>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 sm:mt-20 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">Preguntas frecuentes</h3>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-2">¿Puedo cambiar de plan en cualquier momento?</h4>
                <p className="text-gray-600">Sí, puedes actualizar o reducir tu plan cuando lo necesites. Los cambios se reflejan inmediatamente.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-2">¿Qué incluye la prueba gratuita?</h4>
                <p className="text-gray-600">14 días completos con acceso a todas las funciones del plan Professional, sin restricciones.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-2">¿Hay costos de setup o implementación?</h4>
                <p className="text-gray-600">No, todos nuestros planes incluyen onboarding completo sin costos adicionales.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-6">
            Comienza tu transformación hoy
          </h2>
          <p className="text-lg sm:text-xl text-orange-100 mb-8 sm:mb-12 leading-relaxed">
            Miles de marcas confían en Sewdle para gestionar su producción
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleCTAClick} variant="outline" className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-full border-2 border-white text-white hover:bg-white hover:text-orange-500 transition-all duration-300">
              Ver demo
            </Button>
            <Button onClick={handleCTAClick} className="bg-white text-orange-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              Empezar gratis ahora
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gradient-to-b from-secondary to-accent border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center mb-6">
            <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-12 w-auto" />
          </div>
          <p className="text-muted-foreground">{t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
