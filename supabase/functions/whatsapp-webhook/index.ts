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

    // Parse the incoming request body (assuming JSON from WhatsApp webhook)
    const payload = await req.json();
    console.log('Received WhatsApp webhook payload:', payload);

    // --- WhatsApp Verification (if needed, typically for initial setup) ---
    // If Meta requires a verification token, you'd handle it here.
    // Example: if (payload.hub.mode === 'subscribe' && payload.hub.verify_token === 'YOUR_VERIFY_TOKEN') { ... }

    // --- AI Integration Placeholder ---
    // This is where you would call the Google API or ChatGPT API.
    // For example, using ChatGPT:
    // const chatGPTApiKey = Deno.env.get('CHATGPT_API_KEY');
    // const openai = new OpenAI({ apiKey: chatGPTApiKey });
    // const completion = await openai.chat.completions.create({
    //   messages: [{ role: 'user', content: payload.entry[0].changes[0].value.messages[0].text.body }],
    //   model: 'gpt-3.5-turbo',
    // });
    // const aiResponse = completion.choices[0].message.content;

    const aiResponse = "Hello from your Dyad AI assistant!"; // Placeholder response

    // --- Send Response back to WhatsApp Placeholder ---
    // You would typically use Meta's WhatsApp Business Platform API to send a message back.
    // This would involve making an HTTP POST request to their API endpoint.
    // Example:
    // const whatsappApiToken = Deno.env.get('WHATSAPP_API_TOKEN');
    // await fetch(`https://graph.facebook.com/v19.0/${YOUR_PHONE_NUMBER_ID}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${whatsappApiToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     messaging_product: 'whatsapp',
    //     to: payload.entry[0].changes[0].value.messages[0].from, // User's WhatsApp ID
    //     type: 'text',
    //     text: { body: aiResponse },
    //   }),
    // });

    return new Response(JSON.stringify({ status: 'success', message: aiResponse }), {
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