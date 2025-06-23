
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  name: string;
  email: string;
  role: string;
  workshopId?: string;
  requiresPasswordChange?: boolean;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Crear cliente con service_role para operaciones admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Crear cliente normal para verificar permisos del usuario actual
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader!,
          },
        },
      }
    );

    // Verificar que el usuario esté autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Usuario no autenticado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Verificar que el usuario sea administrador
    const { data: isAdminResult, error: adminError } = await supabase
      .rpc('is_admin', { user_uuid: user.id });

    if (adminError || !isAdminResult) {
      console.error('Usuario sin permisos de administrador:', adminError);
      return new Response(
        JSON.stringify({ error: 'Sin permisos de administrador' }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const userData: CreateUserRequest = await req.json();
    console.log('Datos del usuario a crear:', { ...userData, email: userData.email });

    // Generar contraseña temporal
    const tempPassword = generatePassword();

    // Crear usuario en auth usando admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        requiresPasswordChange: userData.requiresPasswordChange || true
      }
    });

    if (authError) {
      console.error('Error creando usuario en auth:', authError);
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${authError.message}` }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'No se pudo crear el usuario' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Usuario creado en auth:', authData.user.id);

    // Crear/actualizar perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        name: userData.name,
        email: userData.email.toLowerCase().trim()
      });

    if (profileError) {
      console.error('Error creando perfil:', profileError);
      // Intentar eliminar el usuario de auth si falla el perfil
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Error creando perfil: ${profileError.message}` }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Obtener el ID del rol
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', userData.role)
      .single();

    if (roleError || !role) {
      console.error('Error obteniendo rol:', roleError);
      // Limpiar usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Rol no encontrado: ${userData.role}` }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Asignar rol al usuario
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role_id: role.id,
        workshop_id: userData.workshopId || null
      });

    if (userRoleError) {
      console.error('Error asignando rol:', userRoleError);
      // Limpiar usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Error asignando rol: ${userRoleError.message}` }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Usuario creado exitosamente:', authData.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: userData.name
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error general en create-user:', error);
    return new Response(
      JSON.stringify({ error: `Error interno: ${error.message}` }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
