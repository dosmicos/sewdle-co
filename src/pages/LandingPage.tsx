import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, useScroll, useTransform } from "framer-motion";
import LanguageSelector from "@/components/LanguageSelector";
import MobileNavigation from "@/components/MobileNavigation";
import { FadeUp } from "@/components/animations/FadeUp";
import { LetterReveal } from "@/components/animations/LetterReveal";
import { Ticker } from "@/components/animations/Ticker";
import { StickyHowItWorks } from "@/components/StickyHowItWorks";
import { ANIMATION, scaleInVariants, slideFromCornerVariants, getReducedMotionVariants } from "@/lib/animations";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const handleCTAClick = () => {
    navigate('/signup');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  // Refined parallax transforms
  const isMobileDevice = useIsMobile();
  const parallaxDistance = isMobileDevice ? ANIMATION.DISTANCE.PARALLAX_MOBILE : ANIMATION.DISTANCE.PARALLAX;
  
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, parallaxDistance]);
  const centralScale = useTransform(scrollYProgress, [0, 0.2], [1, ANIMATION.SCALE.CENTRAL_MIN]);
  const centralOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.92]);

  // Ticker items
  const tickerItems = [
    "Órdenes centralizadas",
    "Control en tiempo real", 
    "Talleres conectados",
    "Materiales optimizados",
    "Comunicación fluida",
    "Escalabilidad garantizada"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.header 
        className="relative z-50 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ANIMATION.DURATION.NORMAL, delay: 0.05 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-6 w-auto" />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6">
              <button onClick={() => scrollToSection('como-funciona')} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                {t('nav.howItWorks')}
              </button>
              <button onClick={() => scrollToSection('casos-de-uso')} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                {t('nav.useCases')}
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                Precios
              </button>
              <button onClick={() => scrollToSection('integraciones')} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                {t('nav.integrations')}
              </button>
            </nav>

            {/* Right side items */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <LanguageSelector />
              
              {/* Desktop Auth Buttons */}
              <div className="hidden md:flex items-center space-x-3">
                <Button onClick={handleCTAClick} variant="ghost" className="text-sm font-medium">
                  {t('nav.login')}
                </Button>
                <Button onClick={handleCTAClick} className="text-sm px-4 py-2 rounded-full">
                  {t('nav.signup')}
                </Button>
              </div>

              {/* Mobile Navigation */}
              <MobileNavigation onCTAClick={handleCTAClick} scrollToSection={scrollToSection} />
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section with cream gradient background */}
      <motion.section 
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center px-4 py-20"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 40%, hsl(var(--cream-50)) 0%, hsl(var(--cream-100)) 100%)"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ANIMATION.DURATION.NORMAL, delay: 0.05 }}
      >
        <div className="container max-w-6xl mx-auto relative">
          {/* Central card with refined title animation */}
          <motion.div 
            className="text-center mb-16 relative z-10"
            style={{ 
              scale: centralScale,
              opacity: centralOpacity
            }}
          >
            <motion.div
              {...getReducedMotionVariants(scaleInVariants)}
              initial="initial"
              whileInView="animate"
              viewport={ANIMATION.VIEWPORT}
            >
              <Card className="inline-block p-8 md:p-12 max-w-4xl mx-auto bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                  <LetterReveal 
                    text="¿Tu producción se está volviendo caótica?"
                    delay={0.2}
                  />
                </h1>
              </Card>
            </motion.div>
          </motion.div>

          {/* Problem cards with refined animations */}
          <div className="relative">
            {/* Desktop layout */}
            <div className="hidden md:block">
              {/* Top left */}
              <motion.div 
                className="absolute top-0 left-0 w-80"
                style={{ y: yParallax }}
                {...getReducedMotionVariants(slideFromCornerVariants('tl'))}
                initial="initial"
                whileInView="animate"
                viewport={ANIMATION.VIEWPORT}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-6 bg-white/70 backdrop-blur-sm border border-orange-200 shadow-lg">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0"
                      animate={{ 
                        scale: [1, 1.06, 1] 
                      }}
                      transition={{ 
                        duration: 2.5, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <p className="text-gray-700 font-medium">
                      Órdenes dispersas en emails y hojas de cálculo.
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* Top right */}
              <motion.div 
                className="absolute top-0 right-0 w-80"
                style={{ y: yParallax }}
                {...getReducedMotionVariants(slideFromCornerVariants('tr'))}
                initial="initial"
                whileInView="animate"
                viewport={ANIMATION.VIEWPORT}
                transition={{ delay: 0.42 }}
              >
                <Card className="p-6 bg-white/70 backdrop-blur-sm border border-orange-200 shadow-lg">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0"
                      animate={{ 
                        scale: [1, 1.06, 1] 
                      }}
                      transition={{ 
                        duration: 2.5, 
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.8
                      }}
                    />
                    <p className="text-gray-700 font-medium">
                      Cero visibilidad en tiempo real del avance.
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* Bottom left */}
              <motion.div 
                className="absolute bottom-0 left-0 w-80"
                style={{ y: yParallax }}
                {...getReducedMotionVariants(slideFromCornerVariants('bl'))}
                initial="initial"
                whileInView="animate"
                viewport={ANIMATION.VIEWPORT}
                transition={{ delay: 0.54 }}
              >
                <Card className="p-6 bg-white/70 backdrop-blur-sm border border-orange-200 shadow-lg">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0"
                      animate={{ 
                        scale: [1, 1.06, 1] 
                      }}
                      transition={{ 
                        duration: 2.5, 
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1.6
                      }}
                    />
                    <p className="text-gray-700 font-medium">
                      Comunicación fragmentada con talleres.
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* Bottom right */}
              <motion.div 
                className="absolute bottom-0 right-0 w-80"
                style={{ y: yParallax }}
                {...getReducedMotionVariants(slideFromCornerVariants('br'))}
                initial="initial"
                whileInView="animate"
                viewport={ANIMATION.VIEWPORT}
                transition={{ delay: 0.66 }}
              >
                <Card className="p-6 bg-white/70 backdrop-blur-sm border border-orange-200 shadow-lg">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0"
                      animate={{ 
                        scale: [1, 1.06, 1] 
                      }}
                      transition={{ 
                        duration: 2.5, 
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2.4
                      }}
                    />
                    <p className="text-gray-700 font-medium">
                      Escalar = más estrés y errores.
                    </p>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Mobile layout with stagger */}
            <div className="md:hidden space-y-4 mt-8">
              {[
                "Órdenes dispersas en emails y hojas de cálculo.",
                "Cero visibilidad en tiempo real del avance.", 
                "Comunicación fragmentada con talleres.",
                "Escalar = más estrés y errores."
              ].map((text, index) => (
                <FadeUp 
                  key={index}
                  delay={0.3 + (index * ANIMATION.STAGGER.CARDS * (isMobileDevice ? ANIMATION.STAGGER.MOBILE_SCALE : 1))}
                >
                  <Card className="p-4 bg-white/70 backdrop-blur-sm border border-orange-200">
                    <div className="flex items-start gap-3">
                      <motion.div 
                        className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0"
                        animate={{ 
                          scale: [1, 1.06, 1] 
                        }}
                        transition={{ 
                          duration: 2.5, 
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.6
                        }}
                      />
                      <p className="text-gray-700 font-medium text-sm">
                        {text}
                      </p>
                    </div>
                  </Card>
                </FadeUp>
              ))}
            </div>
          </div>

          {/* CTA Button with hover micro-interaction */}
          <FadeUp className="text-center mt-16 relative z-10" delay={0.8}>
            <motion.div
              whileHover={{ scale: ANIMATION.SCALE.HOVER }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <Button 
                onClick={handleCTAClick}
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Organiza tu producción ahora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </FadeUp>
        </div>
      </motion.section>

      {/* Ticker Section */}
      <FadeUp>
        <section className="py-16 bg-muted/30">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                La solución completa que necesitas
              </h2>
            </div>
            <Ticker 
              items={tickerItems}
              speed={25}
              className="border-y border-border/50"
            />
          </div>
        </section>
      </FadeUp>

      {/* Sticky How It Works Section */}
      <StickyHowItWorks />

      {/* Benefits Section */}
      <section className="py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-4">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('landing.benefits.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.benefits.subtitle')}
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: t('landing.benefits.benefit1.title'),
                description: t('landing.benefits.benefit1.description'),
                icon: "📊"
              },
              {
                title: t('landing.benefits.benefit2.title'),
                description: t('landing.benefits.benefit2.description'),
                icon: "⚡"
              },
              {
                title: t('landing.benefits.benefit3.title'),
                description: t('landing.benefits.benefit3.description'),
                icon: "🚀"
              }
            ].map((benefit, index) => (
              <FadeUp
                key={index}
                delay={index * ANIMATION.STAGGER.BULLETS}
              >
                <motion.div
                  whileHover={{ scale: ANIMATION.SCALE.HOVER }}
                  transition={{ duration: 0.18 }}
                >
                  <Card className="p-8 h-full hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">{benefit.icon}</div>
                    <h3 className="text-xl font-semibold text-foreground mb-3">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {benefit.description}
                    </p>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="casos-de-uso" className="py-24 bg-muted/50">
        <div className="container max-w-6xl mx-auto px-4">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('landing.useCases.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.useCases.subtitle')}
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: t('landing.useCases.case1.title'),
                description: t('landing.useCases.case1.description'),
                icon: "👗"
              },
              {
                title: t('landing.useCases.case2.title'),
                description: t('landing.useCases.case2.description'),
                icon: "🏠"
              },
              {
                title: t('landing.useCases.case3.title'),
                description: t('landing.useCases.case3.description'),
                icon: "📱"
              },
              {
                title: t('landing.useCases.case4.title'),
                description: t('landing.useCases.case4.description'),
                icon: "🎨"
              },
              {
                title: t('landing.useCases.case5.title'),
                description: t('landing.useCases.case5.description'),
                icon: "⚙️"
              },
              {
                title: t('landing.useCases.case6.title'),
                description: t('landing.useCases.case6.description'),
                icon: "🍽️"
              }
            ].map((useCase, index) => (
              <FadeUp
                key={index}
                delay={index * ANIMATION.STAGGER.BULLETS}
              >
                <motion.div
                  whileHover={{ scale: ANIMATION.SCALE.HOVER }}
                  transition={{ duration: 0.18 }}
                >
                  <Card className="p-6 h-full hover:shadow-lg transition-shadow">
                    <div className="text-3xl mb-4">{useCase.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      {useCase.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {useCase.description}
                    </p>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 bg-background">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <FadeUp>
            <Card className="p-12 bg-gradient-to-br from-primary/5 to-secondary/5 border-0 shadow-xl">
              <blockquote className="text-2xl md:text-3xl font-medium text-foreground mb-8 leading-relaxed">
                "{t('landing.testimonial.quote')}"
              </blockquote>
              <div className="flex items-center justify-center gap-4">
                <div className="text-left">
                  <div className="font-semibold text-foreground">
                    {t('landing.testimonial.author.name')}
                  </div>
                  <div className="text-muted-foreground">
                    {t('landing.testimonial.author.title')}
                  </div>
                </div>
              </div>
            </Card>
          </FadeUp>
        </div>
      </section>

      {/* Differentials Section */}
      <section className="py-24 bg-muted/50">
        <div className="container max-w-6xl mx-auto px-4">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('landing.differentials.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.differentials.subtitle')}
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-12">
            <FadeUp delay={0.1}>
              <Card className="p-8 border-0 shadow-lg bg-background">
                <h3 className="text-2xl font-bold text-foreground mb-6">
                  {t('landing.differentials.others.title')}
                </h3>
                <div className="space-y-4">
                  {[
                    t('landing.differentials.others.point1'),
                    t('landing.differentials.others.point2'),
                    t('landing.differentials.others.point3'),
                    t('landing.differentials.others.point4')
                  ].map((point, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                      <span className="text-muted-foreground">{point}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </FadeUp>

            <FadeUp delay={0.2}>
              <Card className="p-8 border-0 shadow-lg bg-gradient-to-br from-primary/5 to-secondary/5">
                <h3 className="text-2xl font-bold text-foreground mb-6">
                  {t('landing.differentials.sewdle.title')}
                </h3>
                <div className="space-y-4">
                  {[
                    t('landing.differentials.sewdle.point1'),
                    t('landing.differentials.sewdle.point2'),
                    t('landing.differentials.sewdle.point3'),
                    t('landing.differentials.sewdle.point4')
                  ].map((point, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{point}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-4">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('landing.pricing.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.pricing.subtitle')}
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <FadeUp delay={0.1}>
              <Card className="p-8 border-2 border-border hover:shadow-lg transition-shadow">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Starter</h3>
                  <p className="text-muted-foreground mb-6">Para emprendedores y pequeños talleres</p>
                  <div className="text-4xl font-bold text-foreground mb-6">Gratis</div>
                  <div className="space-y-3 mb-8">
                    {[
                      "Hasta 10 órdenes por mes",
                      "1 taller conectado",
                      "Dashboard básico",
                      "Soporte por email"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCTAClick} variant="outline" className="w-full">
                    Empezar gratis
                  </Button>
                </div>
              </Card>
            </FadeUp>

            {/* Professional */}
            <FadeUp delay={0.2}>
              <Card className="p-8 border-2 border-primary shadow-xl relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Más popular
                  </span>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Professional</h3>
                  <p className="text-muted-foreground mb-6">Para marcas en crecimiento</p>
                  <div className="text-4xl font-bold text-foreground mb-2">$49</div>
                  <p className="text-muted-foreground mb-6">por mes</p>
                  <div className="space-y-3 mb-8">
                    {[
                      "Órdenes ilimitadas",
                      "Hasta 5 talleres",
                      "Dashboard avanzado",
                      "Integraciones con Shopify",
                      "Soporte prioritario"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCTAClick} className="w-full">
                    Probar 14 días gratis
                  </Button>
                </div>
              </Card>
            </FadeUp>

            {/* Enterprise */}
            <FadeUp delay={0.3}>
              <Card className="p-8 border-2 border-border hover:shadow-lg transition-shadow">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Enterprise</h3>
                  <p className="text-muted-foreground mb-6">Para grandes operaciones</p>
                  <div className="text-4xl font-bold text-foreground mb-2">Custom</div>
                  <p className="text-muted-foreground mb-6">Contacta para precio</p>
                  <div className="space-y-3 mb-8">
                    {[
                      "Talleres ilimitados",
                      "API personalizada",
                      "Soporte 24/7",
                      "Integraciones custom",
                      "Onboarding dedicado"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCTAClick} variant="outline" className="w-full">
                    Contactar ventas
                  </Button>
                </div>
              </Card>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <FadeUp>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('landing.finalCTA.title')}
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('landing.finalCTA.subtitle')}
            </p>
            <motion.div
              whileHover={{ scale: ANIMATION.SCALE.HOVER }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <Button 
                onClick={handleCTAClick}
                size="lg"
                className="px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {t('landing.finalCTA.button')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </FadeUp>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-muted">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <FadeUp>
            <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-6 w-auto mx-auto mb-4" />
            <p className="text-muted-foreground">
              © 2024 Sewdle. Todos los derechos reservados.
            </p>
          </FadeUp>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;