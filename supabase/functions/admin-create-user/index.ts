import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role of the invoking user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: invokingUser }, error: userError } = await supabaseServiceRoleClient.auth.getUser(token);

    if (userError || !invokingUser) {
      console.error('Error getting invoking user:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: profileData, error: profileError } = await supabaseServiceRoleClient
      .from('profiles')
      .select('role')
      .eq('id', invokingUser.id)
      .single();

    if (profileError || profileData?.role !== 'admin') {
      console.warn(`User ${invokingUser.id} (role: ${profileData?.role}) attempted to create user without admin privileges.`);
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can create users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { email, password, firstName, lastName, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: newUser, error: createUserError } = await supabaseServiceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createUserError) {
      console.error('Error creating user:', createUserError.message);
      return new Response(JSON.stringify({ error: createUserError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Update the profile with the specified role if provided, otherwise it defaults to 'user'
    if (newUser.user && role) {
      const { error: updateProfileError } = await supabaseServiceRoleClient
        .from('profiles')
        .update({ role: role })
        .eq('id', newUser.user.id);

      if (updateProfileError) {
        console.error('Error updating new user profile role:', updateProfileError.message);
        // Decide if you want to roll back user creation or just log the error
      }
    }

    return new Response(JSON.stringify({ status: 'success', user: newUser.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in admin-create-user Edge Function:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});