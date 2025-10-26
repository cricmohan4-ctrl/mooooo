import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Inlined utility function: normalizePhoneNumber
// This function is included directly to avoid module import issues in Deno Edge Functions.
const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  // If it doesn't start with '+', prepend it. Assuming international format.
  // For WhatsApp, numbers usually include country code.
  if (!phoneNumber.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  return `+${digitsOnly}`;
};

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

    const { toPhoneNumber: rawToPhoneNumber, messageBody, whatsappAccountId, userId, mediaUrl, mediaType, mediaCaption, repliedToMessageId } = payload; // Added repliedToMessageId
    const toPhoneNumber = normalizePhoneNumber(rawToPhoneNumber); // Normalize the target phone number

    console.log(`Debugging: mediaType=${mediaType}, mediaUrl=${mediaUrl}, mediaCaption=${mediaCaption}, repliedToMessageId=${repliedToMessageId}`);

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
        to: toPhoneNumber, // Use normalized number for sending
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
        },
      };
      // Only add caption for image and video types. Explicitly set to null for audio.
      if (mediaCaption && (mediaType === 'image' || mediaType === 'video')) {
        messagePayload[mediaType].caption = mediaCaption;
      } else if (mediaType === 'audio') {
        // Do not add caption for audio messages, as it's not supported by WhatsApp API
        // Ensure messageBodyToSave reflects this
        messageBodyToSave = `[audio message]`;
      }
      // Determine messageBodyToSave based on mediaType
      if (mediaType === 'image' || mediaType === 'video') {
        messageBodyToSave = `[${mediaType} message]${mediaCaption ? `: ${mediaCaption}` : ''}`;
      } else if (mediaType === 'audio') {
        messageBodyToSave = `[audio message]`; // Audio messages don't have captions in Meta API
      } else { // document or other types
        messageBodyToSave = `[${mediaType} message]`;
      }
    } else {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: toPhoneNumber, // Use normalized number for sending
        type: 'text',
        text: { body: messageBody },
      };
    }

    // Add context for replies if repliedToMessageId is provided
    if (repliedToMessageId) {
      messagePayload.context = {
        message_id: repliedToMessageId,
      };
      console.log(`Adding context for reply to message ID: ${repliedToMessageId}`);
    }

    console.log(`Attempting to send message to ${toPhoneNumber} via WhatsApp API.`);
    console.log('WhatsApp API URL:', whatsappApiUrl);
    console.log('Request Body:', JSON.stringify(messagePayload, null, 2));

    let response;
    let responseData;
    try {
      response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      console.log('WhatsApp API Raw Response Status:', response.status);
      console.log('WhatsApp API Raw Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      const responseText = await response.text(); // Read as text first
      console.log('WhatsApp API Raw Response Text:', responseText);

      try {
        responseData = JSON.parse(responseText); // Then try to parse as JSON
        console.log('WhatsApp API Parsed Response Data:', JSON.stringify(responseData, null, 2));
      } catch (jsonParseError) {
        console.error('Error parsing WhatsApp API response as JSON:', jsonParseError);
        // If JSON parsing fails, responseData remains undefined or holds the raw text
        responseData = { raw_response: responseText, parse_error: jsonParseError.message };
      }

    } catch (fetchError: any) {
      console.error('Error during fetch to WhatsApp API:', fetchError.message);
      return new Response(JSON.stringify({ status: 'error', message: 'Network or API connection error', details: fetchError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!response.ok) {
      console.error('Error from WhatsApp API (response not OK):', responseData);
      // Extract more specific error details if available
      const errorDetails = responseData?.error?.message || responseData?.error?.details || 'Unknown error from WhatsApp API';
      return new Response(JSON.stringify({ status: 'error', message: `Failed to send message via WhatsApp API: ${errorDetails}`, details: responseData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Always return 200 for client to parse body
      });
    }

    console.log('Message sent successfully via WhatsApp API:', responseData);

    const metaMessageId = responseData.messages?.[0]?.id || null;

    // Save outgoing message to database using service role client
    const { error: insertOutgoingError } = await supabaseServiceRoleClient
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        whatsapp_account_id: whatsappAccountId,
        from_phone_number: whatsappBusinessPhoneNumberId, // The WA Business Account's phone number ID
        to_phone_number: toPhoneNumber, // Use normalized number for saving
        message_body: messageBodyToSave,
        message_type: mediaType || 'text',
        direction: 'outgoing',
        media_url: mediaUrl || null,
        media_caption: mediaCaption && (mediaType === 'image' || mediaType === 'video') ? mediaCaption : null, // Only save caption if it was sent
        meta_message_id: metaMessageId, // Store Meta's message ID
        status: 'sent', // Set initial status to 'sent'
        replied_to_message_id: repliedToMessageId, // Store the ID of the message being replied to
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
            contact_phone_number: toPhoneNumber, // Use normalized number for upsert
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
    console.error('Unhandled error in send-whatsapp-message Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Always return 200 for client to parse body
    });
  }
});