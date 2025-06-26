
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Package, Users, Truck, BarChart3, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleCTAClick = () => {
    navigate('/auth');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Integrated Navigation */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-blue-50"></div>
        
        {/* Navigation Header - Now integrated within hero */}
        <header className="relative z-50 w-full">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-6">
                <button
                  onClick={() => scrollToSection('como-funciona')}
                  className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium"
                >
                  Cómo funciona
                </button>
                <button
                  onClick={() => scrollToSection('casos-de-uso')}
                  className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium"
                >
                  Casos de uso
                </button>
                <button
                  onClick={() => scrollToSection('integraciones')}
                  className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium"
                >
                  Integraciones
                </button>
              </nav>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleCTAClick}
                  variant="ghost"
                  className="text-sm text-gray-600 hover:text-orange-600 font-medium"
                >
                  Iniciar sesión
                </Button>
                <Button
                  onClick={handleCTAClick}
                  className="bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white text-sm px-5 py-2 rounded-full hover:shadow-lg transition-all duration-300"
                >
                  Registrarse
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center space-y-6">
            {/* Headline */}
            <div className="space-y-4 max-w-4xl mx-auto">
              <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">
                Toma el control total de tu
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  {" "}producción textil
                </span>
              </h1>
              <p className="text-base lg:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                La plataforma que conecta tu marca de moda con todos tus talleres y fabricantes, 
                para una gestión sin límites ni sobresaltos.
              </p>
            </div>

            {/* CTA */}
            <div className="pt-6">
              <Button 
                onClick={handleCTAClick}
                className="bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white px-8 py-4 text-lg font-semibold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Empezar ahora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-12">
            ¿Tu marca crece, pero la producción se vuelve caótica?
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            {[
              'Órdenes dispersas en emails y hojas de cálculo.',
              'Cero visibilidad en tiempo real del avance.',
              'Comunicación fragmentada con talleres.',
              'Escalar = más estrés y errores.'
            ].map((problem, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-white rounded-xl shadow-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-3 flex-shrink-0"></div>
                <p className="text-lg text-gray-700">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Redesigned with animated flow */}
      <section id="como-funciona" className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Sewdle en 30 segundos
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Un flujo de trabajo optimizado que transforma tu producción textil
            </p>
          </div>
          
          {/* Animated Flow Container */}
          <div className="relative">
            {/* Flow Steps */}
            <div className="grid lg:grid-cols-4 gap-8 lg:gap-12 relative">
              {[
                {
                  icon: Package,
                  title: 'Órdenes centralizadas',
                  description: 'Crea, asigna y sigue cada orden desde un único panel de control intuitivo.',
                  color: 'from-orange-500 to-red-500',
                  delay: '0s'
                },
                {
                  icon: Users,
                  title: 'Talleres conectados',
                  description: 'Chat en tiempo real y capacidad de cada taller visible al instante.',
                  color: 'from-blue-500 to-indigo-500',
                  delay: '0.2s'
                },
                {
                  icon: Truck,
                  title: 'Trazabilidad total',
                  description: 'Diseño → insumos → producción → entrega, todo registrado y monitoreado.',
                  color: 'from-green-500 to-emerald-500',
                  delay: '0.4s'
                },
                {
                  icon: BarChart3,
                  title: 'Dashboard ejecutivo',
                  description: 'KPIs de avance, cumplimiento y capacidad en tiempo real.',
                  color: 'from-purple-500 to-pink-500',
                  delay: '0.6s'
                }
              ].map((feature, index) => (
                <div key={index} className="relative group">
                  {/* Animated Card */}
                  <div 
                    className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border border-gray-100 animate-fade-in"
                    style={{ animationDelay: feature.delay }}
                  >
                    {/* Icon Container with Gradient */}
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-6 mx-auto transform transition-transform duration-300 group-hover:rotate-12`}>
                      <feature.icon className="h-8 w-8 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    </div>
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  
                  {/* Animated Connector - Only show between cards, not after the last one */}
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                      <div className="flex items-center">
                        <div className="w-12 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 animate-pulse"></div>
                        <ArrowRight className="h-4 w-4 text-orange-500 ml-1 animate-bounce" style={{ animationDelay: `${0.8 + index * 0.2}s` }} />
                      </div>
                    </div>
                  )}
                  
                  {/* Mobile Connector */}
                  {index < 3 && (
                    <div className="lg:hidden flex justify-center mt-6 mb-2">
                      <ArrowDown className="h-6 w-6 text-orange-500 animate-bounce" style={{ animationDelay: `${0.8 + index * 0.2}s` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Background Decoration */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-orange-100 rounded-full opacity-20 animate-pulse"></div>
              <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-100 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="text-center mt-16">
            <Button 
              onClick={handleCTAClick}
              variant="outline"
              className="px-8 py-3 text-lg font-semibold border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all duration-300 rounded-full"
            >
              Ver demo interactiva
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Para Marcas de Moda */}
            <Card className="p-8 border-0 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Para Marcas de Moda</h3>
              <div className="space-y-4">
                {[
                  'Visibilidad 360° de la cadena',
                  '30% menos tiempo en coordinación',
                  'Decisiones basadas en datos reales',
                  'Escala hasta 50+ talleres sin perder control'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Para Talleres */}
            <Card className="p-8 border-0 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Para Talleres</h3>
              <div className="space-y-4">
                {[
                  'Órdenes claras y sin ambigüedades',
                  'Mejor planificación de capacidad',
                  'Comunicación directa y rápida',
                  'Entregas puntuales, menos reprocesos'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="casos-de-uso" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Casos de uso
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Marca emergente',
                subtitle: '3 → 15 talleres',
                description: 'Crece sin añadir más personal operativo.'
              },
              {
                title: 'Marca global',
                subtitle: '50+ fabricantes en 3 países',
                description: 'Unifica reporting y estandariza procesos.'
              },
              {
                title: 'Picos de temporada',
                subtitle: 'Demanda extra',
                description: 'Asigna demanda extra a talleres con capacidad libre.'
              }
            ].map((useCase, index) => (
              <Card key={index} className="p-6 text-center border-0 bg-gradient-to-br from-white to-orange-50 hover:shadow-lg transition-shadow duration-300">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                <p className="text-sm text-orange-600 font-medium mb-4">{useCase.subtitle}</p>
                <p className="text-gray-600">{useCase.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <blockquote className="text-2xl lg:text-3xl font-medium text-white leading-relaxed">
            "Con Sewdle coordinamos 12 talleres de manera ordenada y gestionamos 
            devoluciones, imperfectos e insumos de forma eficiente."
          </blockquote>
        </div>
      </section>

      {/* Differentials Section */}
      <section id="integraciones" className="py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              ¿Por qué elegir Sewdle?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Diseñado 100% para moda',
                description: 'No es un ERP genérico.'
              },
              {
                title: 'Integración Shopify nativa',
                description: 'Sincroniza inventario y ventas en segundos.'
              },
              {
                title: 'Escalable y seguro',
                description: 'Infraestructura Supabase/Postgres, cifrado TLS 1.3.'
              },
              {
                title: 'UI sin curva de aprendizaje',
                description: 'Tu equipo opera todo en menos de 1 día.'
              }
            ].map((differential, index) => (
              <div key={index} className="flex items-start space-x-4 p-6 bg-gray-800 rounded-xl">
                <div className="w-3 h-3 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">{differential.title}</h3>
                  <p className="text-gray-300">{differential.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            ¿Listo para tomar control de tu producción?
          </h2>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            Demo personalizada gratuita, configuración sin costo y soporte dedicado.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleCTAClick}
              variant="outline"
              className="px-8 py-4 text-lg font-semibold rounded-full border-2 border-gray-300 hover:border-orange-500 hover:text-orange-500 transition-all duration-300"
            >
              Agendar demo
            </Button>
            <Button 
              onClick={handleCTAClick}
              className="bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white px-8 py-4 text-lg font-semibold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Empezar ahora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" 
              alt="Sewdle Logo" 
              className="h-12 w-auto opacity-80"
            />
          </div>
          <p className="text-gray-400">© 2024 Sewdle. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
