

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Generate cryptographically secure password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const array = new Uint8Array(12)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join('')
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { name, email, role, workshopId, organizationId, requiresPasswordChange = true } = await req.json()

    // Check if user already exists in auth.users
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    let userId: string
    let tempPassword: string
    let reactivated = false

    if (existingUser) {
      // User exists in auth - check organization status
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('status')
        .eq('user_id', existingUser.id)
        .eq('organization_id', organizationId)
        .single()

      if (orgUser && orgUser.status === 'active') {
        // User already active in organization
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Este usuario ya está activo en la organización',
            code: 'user_active'
          }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // User exists but is inactive or not in org - reactivate
      console.log('Reactivating existing user:', existingUser.id)
      
      tempPassword = generateSecurePassword()
      userId = existingUser.id
      reactivated = true

      // Update user password and metadata
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: {
          name,
          requires_password_change: requiresPasswordChange
        }
      })

      if (updateAuthError) {
        console.error('Auth update error:', updateAuthError)
        throw updateAuthError
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: existingUser.id,
          name,
          email,
          organization_id: organizationId,
          requires_password_change: requiresPasswordChange
        })

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw profileError
      }

      // Reactivate or create organization_users entry
      if (orgUser) {
        // Update existing entry to active
        const { error: orgUserError } = await supabase
          .from('organization_users')
          .update({ status: 'active', role: 'member' })
          .eq('user_id', existingUser.id)
          .eq('organization_id', organizationId)

        if (orgUserError) {
          console.error('Organization user update error:', orgUserError)
          throw orgUserError
        }
      } else if (organizationId) {
        // Create new organization_users entry
        const { error: orgUserError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: organizationId,
            user_id: existingUser.id,
            role: 'member',
            status: 'active'
          })

        if (orgUserError) {
          console.error('Organization user insert error:', orgUserError)
          throw orgUserError
        }
      }

      // Delete existing user_roles for this org before reassigning
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', existingUser.id)
        .eq('organization_id', organizationId)

    } else {
      // User doesn't exist - create new
      tempPassword = generateSecurePassword()
      
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

      userId = authData.user!.id

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name,
          email,
          organization_id: organizationId,
          requires_password_change: requiresPasswordChange
        })

      if (profileError) {
        console.error('Profile error:', profileError)
        throw profileError
      }

      // Add user to organization
      if (organizationId) {
        const { error: orgUserError } = await supabase
          .from('organization_users')
          .upsert({
            organization_id: organizationId,
            user_id: userId,
            role: 'member',
            status: 'active'
          })

        if (orgUserError) {
          console.error('Organization user error:', orgUserError)
          throw orgUserError
        }
      }
    }

    // Assign role if provided
    if (role && role !== 'Sin Rol') {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleError) {
        console.error('Role fetch error:', roleError)
        throw roleError
      }

      const { error: userRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleData.id,
          workshop_id: workshopId || null,
          organization_id: organizationId
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
        userId,
        reactivated
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
    
    // Manejar error de email duplicado específicamente
    if (error.code === 'email_exists' || error.message?.includes('already been registered')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Este correo electrónico ya está registrado en el sistema',
          code: 'email_exists'
        }),
        { 
          status: 409, // Conflict
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error al crear el usuario'
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

