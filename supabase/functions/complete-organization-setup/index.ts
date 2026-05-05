import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 50) // Limit length
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    const { 
      userId, 
      organizationName, 
      organizationType, 
      selectedPlan = 'starter', 
      userEmail,
      userName 
    } = await req.json()

    console.log('Setting up organization for user:', userId, 'with data:', { organizationName, organizationType, selectedPlan })

    // Check if user already has an organization
    const { data: existingOrgUser, error: checkError } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing organization:', checkError)
      throw checkError
    }

    if (existingOrgUser) {
      console.log('User already has organization:', existingOrgUser.organization_id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          organizationId: existingOrgUser.organization_id,
          message: 'User already has organization setup'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique slug
    const baseSlug = generateSlug(organizationName)
    let slug = baseSlug
    let counter = 1

    // Check for slug uniqueness
    while (true) {
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!existing) break
      
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Set plan limits based on selected plan
    let planLimits = {
      maxUsers: 3,
      maxOrdersPerMonth: 10,
      maxWorkshops: 5
    }

    if (selectedPlan === 'professional') {
      planLimits = {
        maxUsers: 10,
        maxOrdersPerMonth: -1, // unlimited
        maxWorkshops: 20
      }
    } else if (selectedPlan === 'enterprise') {
      planLimits = {
        maxUsers: -1, // unlimited
        maxOrdersPerMonth: -1,
        maxWorkshops: -1
      }
    }

    // 1. Create organization
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        slug: slug,
        plan: selectedPlan,
        status: 'active',
        max_users: planLimits.maxUsers,
        max_orders_per_month: planLimits.maxOrdersPerMonth,
        max_workshops: planLimits.maxWorkshops,
        settings: {
          organization_type: organizationType
        }
      })
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      throw orgError
    }

    console.log('Created organization:', newOrg.id)

    // 2. Add user as owner of the organization
    const { error: orgUserError } = await supabase
      .from('organization_users')
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        status: 'active'
      })

    if (orgUserError) {
      console.error('Error adding user to organization:', orgUserError)
      throw orgUserError
    }

    // 3. Create or update user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        name: userName,
        email: userEmail,
        organization_id: newOrg.id
      })

    if (profileError) {
      console.error('Error creating/updating profile:', profileError)
      throw profileError
    }

    // 4. Assign Administrador role to the user
    const { data: adminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Administrador')
      .eq('is_system', true)
      .single()

    if (roleError) {
      console.error('Error fetching admin role:', roleError)
      throw roleError
    }

    if (adminRole) {
      const { error: userRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: adminRole.id,
          organization_id: newOrg.id
        })

      if (userRoleError) {
        console.error('Error assigning admin role:', userRoleError)
        throw userRoleError
      }

      console.log('Admin role assigned to user:', userId)
    }

    console.log('Organization setup completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizationId: newOrg.id,
        organizationName: newOrg.name,
        organizationSlug: newOrg.slug,
        plan: newOrg.plan
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in organization setup:', error)
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