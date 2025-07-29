import { supabase } from '@/integrations/supabase/client';

export const createDemoTallerUser = async () => {
  try {
    console.log('🔧 Creando usuario demo del taller...');
    
    // Llamar a la función edge para crear usuario
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        name: 'Demo Taller Marisol',
        email: 'demo-taller-marisol@dosmicos.co',
        role: 'Taller',
        workshopId: '862d85b6-4c63-4845-a448-015ccc5c79ab', // Taller Marisol Trujillo
        requiresPasswordChange: false
      }
    });

    if (error) {
      console.error('❌ Error creando usuario demo:', error);
      throw error;
    }

    console.log('✅ Usuario demo creado exitosamente:', data);
    
    return {
      success: true,
      email: 'demo-taller-marisol@dosmicos.co',
      password: data.tempPassword,
      message: 'Usuario demo creado exitosamente'
    };

  } catch (error: any) {
    console.error('💥 Error en createDemoTallerUser:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al crear usuario demo'
    };
  }
};

export const loginAsDemoUser = async (email: string, password: string) => {
  try {
    console.log('🔑 Iniciando sesión como usuario demo...');
    
    // Limpiar estado de autenticación anterior
    await supabase.auth.signOut();
    
    // Iniciar sesión con las credenciales demo
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ Error en login demo:', error);
      throw error;
    }

    console.log('✅ Login demo exitoso:', data);
    return { success: true, user: data.user };

  } catch (error: any) {
    console.error('💥 Error en loginAsDemoUser:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido en login demo'
    };
  }
};