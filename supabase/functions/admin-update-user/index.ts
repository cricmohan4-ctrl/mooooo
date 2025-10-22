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
      console.warn(`User ${invokingUser.id} (role: ${profileData?.role}) attempted to update user without admin privileges.`);
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can update users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { userId, email, password, firstName, lastName, role } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (firstName !== undefined) updates.user_metadata = { ...updates.user_metadata, first_name: firstName };
    if (lastName !== undefined) updates.user_metadata = { ...updates.user_metadata, last_name: lastName };

    if (Object.keys(updates).length > 0) {
      const { data: updatedUser, error: updateUserError } = await supabaseServiceRoleClient.auth.admin.updateUserById(
        userId,
        updates
      );

      if (updateUserError) {
        console.error('Error updating user:', updateUserError.message);
        return new Response(JSON.stringify({ error: updateUserError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    // Update profile table for first_name, last_name, and role
    const profileUpdates: any = {};
    if (firstName !== undefined) profileUpdates.first_name = firstName;
    if (lastName !== undefined) profileUpdates.last_name = lastName;
    if (role) profileUpdates.role = role;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateProfileError } = await supabaseServiceRoleClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating user profile:', updateProfileError.message);
        return new Response(JSON.stringify({ error: updateProfileError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    return new Response(JSON.stringify({ status: 'success', message: 'User updated successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in admin-update-user Edge Function:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});