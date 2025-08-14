import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FormData {
  // Personal info
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  
  // Organization info
  organizationName: string;
  organizationType: 'brand' | 'other';
  
  // Plan selection
  selectedPlan: 'starter' | 'professional' | 'enterprise';
}

const SignupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    organizationType: 'brand',
    selectedPlan: 'professional'
  });

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return false;
    }
    
    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const validateStep2 = () => {
    if (!formData.organizationName) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre de tu organización",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/');
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    try {
      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            name: formData.name,
            organizationName: formData.organizationName,
            organizationType: formData.organizationType,
            selectedPlan: formData.selectedPlan
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Setup organization immediately for all plans
        try {
          const { data: setupData, error: setupError } = await supabase.functions.invoke('complete-organization-setup', {
            body: { 
              userId: data.user.id,
              organizationName: formData.organizationName,
              organizationType: formData.organizationType,
              selectedPlan: formData.selectedPlan,
              userEmail: formData.email,
              userName: formData.name
            }
          });

          if (setupError) {
            console.error('Organization setup error:', setupError);
            throw new Error('No se pudo crear la organización. Por favor intenta de nuevo.');
          }
        } catch (setupErr) {
          console.error('Failed to setup organization:', setupErr);
          throw setupErr;
        }

        // Now proceed with payment for all plans
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
          body: { 
            planId: formData.selectedPlan === 'professional' ? 'plan_professional' : 
                   formData.selectedPlan === 'enterprise' ? 'plan_enterprise' : 'plan_starter',
            organizationName: formData.organizationName,
            organizationType: formData.organizationType,
            userId: data.user.id,
            userEmail: formData.email,
            userName: formData.name
          }
        });

        if (checkoutError) throw checkoutError;

        // Redirect to Stripe checkout
        if (checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }

        // Fallback if no checkout URL
        toast({
          title: "¡Registro exitoso!",
          description: "Tu cuenta y organización han sido creadas exitosamente"
        });
        
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: "Error de registro",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 29,
      description: 'Perfecto para marcas emergentes',
      features: ['Hasta 10 órdenes/mes', '7 usuarios', '5 talleres', 'Soporte por email'],
      popular: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 69,
      description: 'Para marcas en crecimiento',
      features: ['Órdenes ilimitadas', '22 usuarios', '20 talleres', 'Integración completa Shopify', 'Analytics avanzados', 'Soporte prioritario'],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 190,
      description: 'Para marcas establecidas',
      features: ['Todo ilimitado', 'Usuarios ilimitados', 'White-label disponible', 'API personalizada', 'Gerente de cuenta dedicado', 'Soporte 24/7'],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </button>
          <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Crear tu cuenta en Sewdle</h1>
          <p className="text-gray-600">Comienza tu prueba gratuita de 30 días</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= num ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > num ? <CheckCircle className="w-4 h-4" /> : num}
              </div>
              {num < 3 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > num ? 'bg-orange-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Información personal</h2>
                <p className="text-gray-600">Cuéntanos sobre ti</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo *
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="Tu nombre completo"
                    className="h-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo electrónico *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    placeholder="tu@email.com"
                    className="h-12"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña *
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateFormData('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar contraseña *
                  </label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="h-12"
                  />
                </div>
              </div>
              
              <Button onClick={handleNext} className="w-full h-12 bg-orange-500 hover:bg-orange-600">
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Organization Setup */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Información de tu organización</h2>
                <p className="text-gray-600">Configura tu espacio de trabajo</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la organización *
                </label>
                <Input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => updateFormData('organizationName', e.target.value)}
                  placeholder="Nombre de tu marca o taller"
                  className="h-12"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Tipo de organización
                </label>
                <RadioGroup
                  value={formData.organizationType}
                  onValueChange={(value) => updateFormData('organizationType', value)}
                  className="grid md:grid-cols-3 gap-4"
                >
                  {[
                    { id: 'brand', label: 'Marca de Moda', description: 'Diseño y venta de productos' },
                    { id: 'other', label: 'Otro', description: 'Otro tipo de negocio' }
                  ].map((type) => (
                    <div key={type.id} className="relative">
                      <RadioGroupItem
                        value={type.id}
                        id={type.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={type.id}
                        className={`block p-4 cursor-pointer transition-all border rounded-lg text-center peer-checked:border-orange-500 peer-checked:bg-orange-50 hover:border-gray-300 ${
                          formData.organizationType === type.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <h3 className="font-medium text-gray-900">{type.label}</h3>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <div className="flex gap-4">
                <Button onClick={handleBack} variant="outline" className="flex-1 h-12">
                  Atrás
                </Button>
                <Button onClick={handleNext} className="flex-1 h-12 bg-orange-500 hover:bg-orange-600">
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Plan Selection */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Elige tu plan</h2>
                <p className="text-gray-600">30 días gratis en cualquier plan</p>
              </div>
              
              <div className="grid gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`p-6 cursor-pointer transition-all relative ${
                      formData.selectedPlan === plan.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateFormData('selectedPlan', plan.id as any)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Más Popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                            <p className="text-gray-600">{plan.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">${plan.price}</div>
                            <div className="text-sm text-gray-600">/mes</div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {plan.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ml-4 ${
                        formData.selectedPlan === plan.id
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-gray-300'
                      }`}>
                        {formData.selectedPlan === plan.id && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              <div className="flex gap-4">
                <Button onClick={handleBack} variant="outline" className="flex-1 h-12">
                  Atrás
                </Button>
                <Button 
                  onClick={handleSignup} 
                  disabled={isLoading}
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    `Comenzar prueba gratis`
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <button
              onClick={() => navigate('/auth')}
              className="text-orange-500 hover:text-orange-600 font-medium"
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;