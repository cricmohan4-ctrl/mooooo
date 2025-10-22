import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Create User Function received request ---');
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user making the request is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ status: 'error', message: 'Authorization header missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseServiceRoleClient.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Authentication error:', authError?.message);
      return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized: Invalid token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Fetch the profile of the authenticated user to check their role
    const { data: adminProfile, error: profileError } = await supabaseServiceRoleClient
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      console.warn(`User ${authUser.id} attempted to create user but is not an admin.`);
      return new Response(JSON.stringify({ status: 'error', message: 'Forbidden: Only administrators can create users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { email, password, first_name, last_name, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email and password are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Create the user using the admin client
    const { data: newUser, error: createUserError } = await supabaseServiceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
        role: role || 'user', // Default role to 'user' if not provided
      },
    });

    if (createUserError) {
      console.error('Error creating user:', createUserError.message);
      return new Response(JSON.stringify({ status: 'error', message: `Failed to create user: ${createUserError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // The handle_new_user trigger will automatically create the profile in public.profiles
    // We just need to ensure the trigger is updated to handle the 'role' from user_metadata.

    console.log('User created successfully:', newUser.user?.id);
    return new Response(JSON.stringify({ status: 'success', userId: newUser.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in create-user Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});