import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // --- START: Ultra-basic logging for ALL incoming requests ---
  console.log('--- Webhook received request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
  // --- END: Ultra-basic logging ---

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const payload = await req.json();
    console.log('Received WhatsApp webhook payload:', JSON.stringify(payload, null, 2)); // This should always log if the webhook is received

    // Extract relevant WhatsApp message data
    const messageEntry = payload.entry?.[0];
    const messageChange = messageEntry?.changes?.[0];
    const messageValue = messageChange?.value;
    const incomingMessage = messageValue?.messages?.[0];
    const whatsappBusinessAccountId = messageValue?.metadata?.phone_number_id; // The ID of your WhatsApp Business Account
    const whatsappBusinessPhoneNumber = messageValue?.metadata?.display_phone_number; // The phone number of your WhatsApp Business Account

    if (!incomingMessage || !whatsappBusinessAccountId || !whatsappBusinessPhoneNumber) {
      console.log('No incoming message, account ID, or phone number in payload. Returning 200.'); // Added log
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
      // For now, we'll just store a generic message for unhandled types
      incomingText = `[${incomingMessage.type} message]`;
    }

    const fromPhoneNumber = incomingMessage.from; // The user's WhatsApp ID

    console.log(`Processing message from ${fromPhoneNumber} to ${whatsappBusinessAccountId}: "${incomingText}"`);

    // Fetch the user_id associated with this whatsapp_account_id
    const { data: accountData, error: accountError } = await supabaseClient
      .from('whatsapp_accounts')
      .select('user_id, access_token')
      .eq('phone_number_id', whatsappBusinessAccountId)
      .single();

    if (accountError || !accountData) {
      console.error('Error fetching WhatsApp account or user_id:', accountError?.message);
      // It's important to return a 200 here for Meta, even if we can't process it, to avoid retries.
      return new Response(JSON.stringify({ status: 'error', message: 'WhatsApp account not found or user_id missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 to Meta to prevent retries, but log the error
      });
    }

    const userId = accountData.user_id;
    const whatsappAccessToken = accountData.access_token;

    // Save incoming message to database
    const { error: insertIncomingError } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        whatsapp_account_id: accountData.id, // Use the ID from the fetched account
        from_phone_number: fromPhoneNumber,
        to_phone_number: whatsappBusinessPhoneNumber, // The business's number
        message_body: incomingText,
        message_type: messageType,
        direction: 'incoming',
      });

    if (insertIncomingError) {
      console.error('Error saving incoming message:', insertIncomingError.message);
    } else {
      console.log('Incoming message saved to database.');
    }

    // Fetch chatbot rules for this WhatsApp account
    const { data: rules, error: rulesError } = await supabaseClient
      .from('chatbot_rules')
      .select('trigger_value, trigger_type, response_message, buttons') // Removed whatsapp_accounts(access_token) as we already have it
      .eq('whatsapp_account_id', accountData.id); // Use the ID from the fetched account

    if (rulesError) {
      console.error('Error fetching chatbot rules:', rulesError.message); // Added log
      // Continue processing even if rules fail to fetch, just won't send automated response
    }

    let matchedResponseMessages: string[] = ["I'm sorry, I didn't understand that. Please try again."]; // Default response
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
        break; // Found a match, use this rule's response
      }
    }

    // If an access token was found for the account, attempt to send responses
    if (whatsappAccessToken && whatsappBusinessAccountId) {
      const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessAccountId}/messages`;
      
      // Send all text messages first
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
          // Don't throw here, just log and continue to avoid breaking the entire webhook
        } else {
          console.log('WhatsApp text message sent successfully:', responseData);
        }

        // Save outgoing text message to database
        const { error: insertOutgoingError } = await supabaseClient
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            whatsapp_account_id: accountData.id,
            from_phone_number: whatsappBusinessPhoneNumber, // The business's number
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

      // If there are buttons, send an interactive message with buttons
      if (matchedButtons && matchedButtons.length > 0) {
        const interactiveButtons = matchedButtons.map(btn => ({
          type: "reply",
          reply: {
            id: btn.payload, // Use payload as button ID
            title: btn.text,
          },
        }));

        // WhatsApp interactive messages require a body text
        const interactiveBodyText = matchedResponseMessages.length > 0 
          ? matchedResponseMessages[matchedResponseMessages.length - 1] // Use last text message as body
          : "Please choose an option:"; // Fallback if no text messages

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
          // Don't throw here, just log and continue
        } else {
          console.log('WhatsApp interactive message sent successfully:', responseData);
        }

        // Save outgoing interactive message to database
        const { error: insertOutgoingInteractiveError } = await supabaseClient
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            whatsapp_account_id: accountData.id,
            from_phone_number: whatsappBusinessPhoneNumber, // The business's number
            to_phone_number: fromPhoneNumber,
            message_body: interactiveBodyText, // Store the body text of the interactive message
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