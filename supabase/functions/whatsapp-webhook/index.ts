import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    console.log('Received WhatsApp webhook payload:', JSON.stringify(payload, null, 2));

    // Extract relevant WhatsApp message data
    const messageEntry = payload.entry?.[0];
    const messageChange = messageEntry?.changes?.[0];
    const messageValue = messageChange?.value;
    const message = messageValue?.messages?.[0];

    if (message && message.type === 'text') {
      const incomingText = message.text.body.toLowerCase();
      const fromPhoneNumber = message.from; // The user's WhatsApp ID
      const whatsappBusinessAccountId = messageValue.metadata.phone_number_id; // The ID of your WhatsApp Business Account

      console.log(`Incoming message from ${fromPhoneNumber} to ${whatsappBusinessAccountId}: "${incomingText}"`);

      // Fetch chatbot rules for this WhatsApp account
      const { data: rules, error: rulesError } = await supabaseClient
        .from('chatbot_rules')
        .select('trigger_value, trigger_type, response_message, whatsapp_accounts(access_token)')
        .eq('whatsapp_account_id', whatsappBusinessAccountId);

      if (rulesError) {
        throw rulesError;
      }

      let aiResponse = "I'm sorry, I didn't understand that. Please try again."; // Default response
      let whatsappAccessToken = null;

      for (const rule of rules || []) {
        const triggerValue = rule.trigger_value.toLowerCase();
        const triggerType = rule.trigger_type;
        whatsappAccessToken = (rule.whatsapp_accounts as { access_token: string }).access_token;

        let match = false;
        switch (triggerType) {
          case 'EXACT_MATCH':
            match = incomingText === triggerValue;
            break;
          case 'CONTAINS':
            match = incomingText.includes(triggerValue);
            break;
          case 'STARTS_WITH':
            match = incomingText.startsWith(triggerValue);
            break;
          default:
            break;
        }

        if (match) {
          aiResponse = rule.response_message;
          break; // Found a match, use this rule's response
        }
      }

      // If an access token was found for the account, attempt to send a response
      if (whatsappAccessToken && whatsappBusinessAccountId) {
        console.log(`Sending response: "${aiResponse}" to ${fromPhoneNumber} using account ${whatsappBusinessAccountId}`);
        const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessAccountId}/messages`;
        
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
            text: { body: aiResponse },
          }),
        });

        const responseData = await response.json();
        if (!response.ok) {
          console.error('Error sending WhatsApp message:', responseData);
          throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(responseData)}`);
        }
        console.log('WhatsApp message sent successfully:', responseData);
      } else {
        console.warn('No WhatsApp access token found for the account or phone number ID. Cannot send automated response.');
      }
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