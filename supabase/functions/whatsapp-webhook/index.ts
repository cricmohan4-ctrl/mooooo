import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Webhook received request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- START: Meta Webhook Verification Logic ---
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN'); // Get token from environment variable

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed: Invalid mode or token.');
      return new Response('Verification token mismatch', { status: 403 });
    }
  }
  // --- END: Meta Webhook Verification Logic ---

  // --- START: Existing POST request logic for actual messages ---
  try {
    // Create a Supabase client with the anon key for general operations (e.g., inserting messages)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create a Supabase client with the service role key to bypass RLS for specific queries
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Received WhatsApp webhook payload:', JSON.stringify(payload, null, 2));

    const messageEntry = payload.entry?.[0];
    const messageChange = messageEntry?.changes?.[0];
    const messageValue = messageChange?.value;
    const incomingMessage = messageValue?.messages?.[0];
    const whatsappBusinessAccountId = messageValue?.metadata?.phone_number_id;
    const whatsappBusinessPhoneNumber = messageValue?.metadata?.display_phone_number;

    if (!incomingMessage || !whatsappBusinessAccountId || !whatsappBusinessPhoneNumber) {
      console.log('No incoming message, account ID, or phone number in payload. Returning 200.');
      return new Response(JSON.stringify({ status: 'success', message: 'No message or account info to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let incomingText = "";
    let messageType = incomingMessage.type;

    if (incomingMessage.type === 'text') {
      incomingText = incomingMessage.text.body;
    } else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'button_reply') {
      incomingText = incomingMessage.interactive.button_reply.payload;
    } else {
      console.log(`Unhandled message type: ${incomingMessage.type}`);
      incomingText = `[${incomingMessage.type} message]`;
    }

    const fromPhoneNumber = incomingMessage.from;

    console.log(`Processing message from ${fromPhoneNumber} to ${whatsappBusinessAccountId}: "${incomingText}"`);

    // Use supabaseServiceRoleClient to fetch account data, bypassing RLS
    const { data: accountData, error: accountError } = await supabaseServiceRoleClient
      .from('whatsapp_accounts')
      .select('id, user_id, access_token') // Select 'id' as well
      .eq('phone_number_id', whatsappBusinessAccountId)
      .single();

    if (accountError || !accountData) {
      console.error('Error fetching WhatsApp account or user_id:', accountError?.message);
      return new Response(JSON.stringify({ status: 'error', message: 'WhatsApp account not found or user_id missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const userId = accountData.user_id;
    const whatsappAccessToken = accountData.access_token;
    const whatsappAccountId = accountData.id; // Get the account ID

    const { error: insertIncomingError } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        whatsapp_account_id: whatsappAccountId, // Use the fetched account ID
        from_phone_number: fromPhoneNumber,
        to_phone_number: whatsappBusinessPhoneNumber,
        message_body: incomingText,
        message_type: messageType,
        direction: 'incoming',
      });

    if (insertIncomingError) {
      console.error('Error saving incoming message:', insertIncomingError.message);
    } else {
      console.log('Incoming message saved to database.');
    }

    const { data: rules, error: rulesError } = await supabaseServiceRoleClient // Use service role client for rules
      .from('chatbot_rules')
      .select('trigger_value, trigger_type, response_message, buttons')
      .eq('whatsapp_account_id', whatsappAccountId); // Filter by the fetched account ID

    if (rulesError) {
      console.error('Error fetching chatbot rules:', rulesError.message);
    }

    let matchedResponseMessages: string[] = ["I'm sorry, I didn't understand that. Please try again."];
    let matchedButtons: { text: string; payload: string }[] | null = null;

    const lowerCaseIncomingText = incomingText.toLowerCase();

    for (const rule of rules || []) {
      const triggerValue = rule.trigger_value.toLowerCase();
      const triggerType = rule.trigger_type;

      let match = false;
      switch (triggerType) {
        case 'EXACT_MATCH':
          match = lowerCaseIncomingText === triggerValue;
          break;
        case 'CONTAINS':
          match = lowerCaseIncomingText.includes(triggerValue);
          break;
        case 'STARTS_WITH':
          match = lowerCaseIncomingText.startsWith(triggerValue);
          break;
        default:
          break;
      }

      if (match) {
        matchedResponseMessages = rule.response_message as string[];
        matchedButtons = rule.buttons as { text: string; payload: string }[] | null;
        break;
      }
    }

    if (whatsappAccessToken && whatsappBusinessAccountId) {
      const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessAccountId}/messages`;
      
      for (const responseMessage of matchedResponseMessages) {
        console.log(`Sending text response: "${responseMessage}" to ${fromPhoneNumber} using account ${whatsappBusinessAccountId}`);
        const response = await fetch(whatsappApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: fromPhoneNumber,
            type: 'text',
            text: { body: responseMessage },
          }),
        });

        const responseData = await response.json();
        if (!response.ok) {
          console.error('Error sending WhatsApp text message:', responseData);
        } else {
          console.log('WhatsApp text message sent successfully:', responseData);
        }

        const { error: insertOutgoingError } = await supabaseClient
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            whatsapp_account_id: whatsappAccountId, // Use the fetched account ID
            from_phone_number: whatsappBusinessPhoneNumber,
            to_phone_number: fromPhoneNumber,
            message_body: responseMessage,
            message_type: 'text',
            direction: 'outgoing',
          });

        if (insertOutgoingError) {
          console.error('Error saving outgoing text message:', insertOutgoingError.message);
        } else {
          console.log('Outgoing text message saved to database.');
        }
      }

      if (matchedButtons && matchedButtons.length > 0) {
        const interactiveButtons = matchedButtons.map(btn => ({
          type: "reply",
          reply: {
            id: btn.payload,
            title: btn.text,
          },
        }));

        const interactiveBodyText = matchedResponseMessages.length > 0 
          ? matchedResponseMessages[matchedResponseMessages.length - 1]
          : "Please choose an option:";

        console.log(`Sending interactive buttons to ${fromPhoneNumber} using account ${whatsappBusinessAccountId}`);
        const response = await fetch(whatsappApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: fromPhoneNumber,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: {
                text: interactiveBodyText,
              },
              action: {
                buttons: interactiveButtons,
              },
            },
          }),
        });

        const responseData = await response.json();
        if (!response.ok) {
          console.error('Error sending WhatsApp interactive message:', responseData);
        } else {
          console.log('WhatsApp interactive message sent successfully:', responseData);
        }

        const { error: insertOutgoingInteractiveError } = await supabaseClient
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            whatsapp_account_id: whatsappAccountId, // Use the fetched account ID
            from_phone_number: whatsappBusinessPhoneNumber,
            to_phone_number: fromPhoneNumber,
            message_body: interactiveBodyText,
            message_type: 'interactive',
            direction: 'outgoing',
          });

        if (insertOutgoingInteractiveError) {
          console.error('Error saving outgoing interactive message:', insertOutgoingInteractiveError.message);
        } else {
          console.log('Outgoing interactive message saved to database.');
        }
      }

    } else {
      console.warn('No WhatsApp access token found for the account or phone number ID. Cannot send automated response.');
    }

    return new Response(JSON.stringify({ status: 'success', message: 'Webhook processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});