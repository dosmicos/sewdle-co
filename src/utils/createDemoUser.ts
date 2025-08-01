import { supabase } from '@/integrations/supabase/client';

export const createDemoTallerUser = async () => {
  try {
    console.log('🔧 Creando usuario demo del taller...');
    
    // Generar email único más corto con timestamp
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
    const uniqueEmail = `demo-marisol-${timestamp}@demo.co`;
    
    // Llamar a la función edge para crear usuario
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        name: 'Demo Marisol',
        email: uniqueEmail,
        role: 'Taller',
        workshopId: '862d85b6-4c63-4845-a448-015ccc5c79ab', // Taller Marisol Trujillo
        organizationId: 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb', // Misma organización
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
      email: uniqueEmail,
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

export const createDemoGADKidsUser = async () => {
  try {
    console.log('🔧 Creando usuario demo del taller GAD Kids...');
    
    // Generar email único más corto con timestamp
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
    const uniqueEmail = `demo-gad-${timestamp}@demo.co`;
    
    // Llamar a la función edge para crear usuario
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        name: 'Demo GAD Kids',
        email: uniqueEmail,
        role: 'Taller',
        workshopId: '580d9878-de70-4117-93b4-16811aeeff80', // Taller GAD Kids
        organizationId: 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb', // Misma organización que Jhon Barragan
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
      email: uniqueEmail,
      password: data.tempPassword,
      message: 'Usuario demo creado exitosamente'
    };

  } catch (error: any) {
    console.error('💥 Error en createDemoGADKidsUser:', error);
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