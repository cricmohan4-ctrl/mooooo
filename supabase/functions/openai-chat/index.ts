import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.47.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- OpenAI Chat Function received request ---');
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables.');
      return new Response(JSON.stringify({ status: 'error', message: 'OpenAI API key not configured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log('OPENAI_API_KEY is present.'); // Log that the key is found

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const payload = await req.json();
    const { message } = payload;

    if (!message) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing message in payload.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log('Sending message to OpenAI:', message);

    let chatCompletion;
    try {
      chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // You can change this to a different model like "gpt-4" if preferred
        messages: [{ role: "user", content: message }],
        max_tokens: 150,
      });
      console.log('OpenAI API call successful. Response:', JSON.stringify(chatCompletion, null, 2));
    } catch (openaiApiError: any) {
      console.error('Error calling OpenAI API:', openaiApiError.message);
      // If there's a specific error response from OpenAI, log it
      if (openaiApiError.response) {
        console.error('OpenAI API Error Response Data:', JSON.stringify(openaiApiError.response.data, null, 2));
      }
      return new Response(JSON.stringify({ status: 'error', message: 'Failed to get response from OpenAI API', details: openaiApiError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const aiResponse = chatCompletion.choices[0].message.content;
    console.log('Received AI response:', aiResponse);

    return new Response(JSON.stringify({ status: 'success', response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in OpenAI Chat Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});