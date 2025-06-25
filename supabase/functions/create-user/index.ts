

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { name, email, role, workshopId, requiresPasswordChange = true } = await req.json()

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
    
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name,
        requires_password_change: requiresPasswordChange
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    // Create or update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user!.id,
        name,
        email,
        requires_password_change: requiresPasswordChange
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      throw profileError
    }

    // Assign role if provided
    if (role && role !== 'Sin Rol') {
      // Get role ID
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleError) {
        console.error('Role fetch error:', roleError)
        throw roleError
      }

      // Assign role to user
      const { error: userRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user!.id,
          role_id: roleData.id,
          workshop_id: workshopId || null
        })

      if (userRoleError) {
        console.error('User role error:', userRoleError)
        throw userRoleError
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
        userId: authData.user!.id
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

