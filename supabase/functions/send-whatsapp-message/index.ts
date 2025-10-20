import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Send WhatsApp Message Function received request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key to bypass RLS for fetching account details and inserting outgoing messages
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Received payload for sending message:', JSON.stringify(payload, null, 2));

    const { toPhoneNumber, messageBody, whatsappAccountId, userId } = payload;

    if (!toPhoneNumber || !messageBody || !whatsappAccountId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: toPhoneNumber, messageBody, whatsappAccountId, userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch WhatsApp account details using service role client
    const { data: accountData, error: accountError } = await supabaseServiceRoleClient
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token')
      .eq('id', whatsappAccountId)
      .eq('user_id', userId)
      .single();

    if (accountError || !accountData) {
      console.error('Error fetching WhatsApp account details:', accountError?.message);
      return new Response(JSON.stringify({ error: 'WhatsApp account not found or access denied.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const whatsappBusinessPhoneNumberId = accountData.phone_number_id;
    const whatsappAccessToken = accountData.access_token;

    if (!whatsappAccessToken || !whatsappBusinessPhoneNumberId) {
      return new Response(JSON.stringify({ error: 'WhatsApp access token or phone number ID not configured for this account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessPhoneNumberId}/messages`;
    const messagePayload = {
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      type: 'text',
      text: { body: messageBody },
    };

    console.log(`Attempting to send message to ${toPhoneNumber} via WhatsApp API.`);
    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Error from WhatsApp API:', responseData);
      return new Response(JSON.stringify({ error: 'Failed to send message via WhatsApp API', details: responseData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    console.log('Message sent successfully via WhatsApp API:', responseData);

    // Save outgoing message to database using service role client
    const { error: insertOutgoingError } = await supabaseServiceRoleClient
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        whatsapp_account_id: whatsappAccountId,
        from_phone_number: whatsappBusinessPhoneNumberId, // The WA Business Account's phone number ID
        to_phone_number: toPhoneNumber,
        message_body: messageBody,
        message_type: 'text',
        direction: 'outgoing',
      });

    if (insertOutgoingError) {
      console.error('Error saving outgoing message to database:', insertOutgoingError.message);
      // Continue, as the message was already sent via WhatsApp API
    } else {
      console.log('Outgoing message saved to database.');
      // Update or create conversation entry for outgoing message
      await supabaseServiceRoleClient
        .from('whatsapp_conversations')
        .upsert(
          {
            user_id: userId,
            whatsapp_account_id: whatsappAccountId,
            contact_phone_number: toPhoneNumber,
            last_message_at: new Date().toISOString(),
            last_message_body: messageBody,
          },
          { onConflict: 'whatsapp_account_id,contact_phone_number' }
        );
    }

    return new Response(JSON.stringify({ status: 'success', data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in send-whatsapp-message Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});