import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Package, BarChart3, TrendingUp } from "lucide-react";
import { ANIMATION, getReducedMotionVariants } from "@/lib/animations";
import { FadeUp } from "@/components/animations/FadeUp";

const tabs = [
  {
    id: "order",
    title: "Ordena",
    icon: Package,
    content: {
      title: "Centraliza toda tu producción",
      description: "Gestiona órdenes, materiales y talleres desde una sola plataforma",
      features: [
        "Órdenes centralizadas sin emails",
        "Asignación automática de talleres",
        "Control de materiales en tiempo real",
        "Comunicación directa integrada"
      ]
    }
  },
  {
    id: "control",
    title: "Controla", 
    icon: BarChart3,
    content: {
      title: "Visibilidad total del proceso",
      description: "Monitorea cada etapa de producción con dashboards en tiempo real",
      features: [
        "Dashboard en tiempo real",
        "Alertas automáticas de retrasos",
        "Tracking de materiales",
        "Reportes de productividad"
      ]
    }
  },
  {
    id: "scale",
    title: "Escala",
    icon: TrendingUp,
    content: {
      title: "Crece sin perder el control",
      description: "Automatiza procesos y optimiza recursos para crecer de forma sostenible",
      features: [
        "Automatización de flujos",
        "Optimización de recursos",
        "Análisis predictivo",
        "Escalabilidad sin límites"
      ]
    }
  }
];

export const StickyHowItWorks = () => {
  const [activeTab, setActiveTab] = useState("order");
  
  const activeContent = tabs.find(tab => tab.id === activeTab);
  
  const tabVariants = {
    initial: { opacity: 0, x: -ANIMATION.DISTANCE.SLIDE_TAB },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: ANIMATION.DURATION.NORMAL,
        ease: ANIMATION.EASING
      }
    },
    exit: { 
      opacity: 0, 
      x: ANIMATION.DISTANCE.SLIDE_TAB,
      transition: {
        duration: ANIMATION.DURATION.FAST,
        ease: ANIMATION.EASING
      }
    }
  };

  const bulletVariants = {
    initial: { opacity: 0, x: -8 },
    animate: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: ANIMATION.DURATION.NORMAL,
        ease: ANIMATION.EASING,
        delay: i * ANIMATION.STAGGER.BULLETS
      }
    })
  };

  const variants = getReducedMotionVariants(tabVariants);
  const bulletVars = getReducedMotionVariants(bulletVariants);

  return (
    <div className="sticky top-0 min-h-screen flex items-center justify-center py-20">
      <div className="container max-w-6xl mx-auto px-4">
        <FadeUp className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Cómo funciona
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Un sistema simple que transforma tu caos productivo en orden total
          </p>
        </FadeUp>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Tabs */}
          <div className="space-y-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-6 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'bg-card hover:bg-accent border border-border'
                  }`}
                  whileHover={{ scale: ANIMATION.SCALE.HOVER }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      isActive ? 'bg-primary-foreground/20' : 'bg-primary/10'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        isActive ? 'text-primary-foreground' : 'text-primary'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{tab.title}</h3>
                      <p className={`text-sm ${
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}>
                        {tab.content.description}
                      </p>
                    </div>
                    <ArrowRight className={`w-5 h-5 ml-auto ${
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Content */}
          <div className="lg:pl-8">
            <AnimatePresence mode="wait">
              {activeContent && (
                <motion.div
                  key={activeTab}
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Card className="p-8 border-0 shadow-xl bg-gradient-to-br from-background to-accent/5">
                    <h3 className="text-2xl font-bold text-foreground mb-4">
                      {activeContent.content.title}
                    </h3>
                    <p className="text-muted-foreground mb-8 text-lg">
                      {activeContent.content.description}
                    </p>
                    
                    <div className="space-y-4">
                      {activeContent.content.features.map((feature, index) => (
                        <motion.div
                          key={feature}
                          custom={index}
                          variants={bulletVars}
                          initial="initial"
                          animate="animate"
                          className="flex items-center gap-3"
                        >
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};