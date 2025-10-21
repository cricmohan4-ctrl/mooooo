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

    const { toPhoneNumber, messageBody, whatsappAccountId, userId, mediaUrl, mediaType, mediaCaption } = payload;

    if (!toPhoneNumber || !whatsappAccountId || !userId) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required parameters: toPhoneNumber, whatsappAccountId, userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // If it's a text message, messageBody is required
    if (!mediaUrl && !messageBody) {
      return new Response(JSON.stringify({ status: 'error', message: 'Either messageBody or mediaUrl must be provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Fetch WhatsApp account details using service role client
    const { data: accountData, error: accountError } = await supabaseServiceRoleClient
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token, account_name')
      .eq('id', whatsappAccountId)
      .eq('user_id', userId)
      .single();

    if (accountError || !accountData) {
      console.error('Error fetching WhatsApp account details:', accountError?.message);
      return new Response(JSON.stringify({ status: 'error', message: 'WhatsApp account not found or access denied.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const whatsappBusinessPhoneNumberId = accountData.phone_number_id;
    const whatsappAccessToken = accountData.access_token;
    const whatsappAccountName = accountData.account_name;

    if (!whatsappAccessToken || !whatsappBusinessPhoneNumberId) {
      return new Response(JSON.stringify({ status: 'error', message: 'WhatsApp access token or phone number ID not configured for this account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessPhoneNumberId}/messages`;
    let messagePayload: any;
    let messageBodyToSave = messageBody; // Default to text message body

    if (mediaUrl && mediaType) {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: toPhoneNumber,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
        },
      };
      if (mediaCaption) {
        messagePayload[mediaType].caption = mediaCaption;
      }
      messageBodyToSave = `[${mediaType} message]${mediaCaption ? `: ${mediaCaption}` : ''}`;
    } else {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: toPhoneNumber,
        type: 'text',
        text: { body: messageBody },
      };
    }

    console.log(`Attempting to send message to ${toPhoneNumber} via WhatsApp API.`);
    console.log('WhatsApp API URL:', whatsappApiUrl);
    console.log('Request Body:', JSON.stringify(messagePayload, null, 2)); // Added detailed request body logging
    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();
    console.log('WhatsApp API Response Status:', response.status); // Added response status logging
    console.log('WhatsApp API Response Data:', JSON.stringify(responseData, null, 2)); // Added detailed response data logging

    if (!response.ok) {
      console.error('Error from WhatsApp API:', responseData);
      return new Response(JSON.stringify({ status: 'error', message: 'Failed to send message via WhatsApp API', details: responseData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Always return 200 for client to parse body
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
        message_body: messageBodyToSave,
        message_type: mediaType || 'text',
        direction: 'outgoing',
        media_url: mediaUrl || null,
        media_caption: mediaCaption || null,
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
            last_message_body: messageBodyToSave,
          },
          { onConflict: 'whatsapp_account_id,contact_phone_number' }
        );
    }

    return new Response(JSON.stringify({ status: 'success', data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in send-whatsapp-message Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Always return 200 for client to parse body
    });
  }
});