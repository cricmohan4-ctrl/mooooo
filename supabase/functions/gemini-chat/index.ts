import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Google Gemini Chat Function received request ---');
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GOOGLE_GEMINI_API_KEY is not set in environment variables.');
      return new Response(JSON.stringify({ status: 'error', message: 'Google Gemini API key not configured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log('GOOGLE_GEMINI_API_KEY is present.');

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Using gemini-pro model

    const payload = await req.json();
    const { message } = payload;

    if (!message) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing message in payload.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log('Sending message to Google Gemini:', message);

    let chatCompletion;
    try {
      const result = await model.generateContent(message);
      chatCompletion = result.response;
      console.log('Google Gemini API call successful. Response:', JSON.stringify(chatCompletion, null, 2));
    } catch (geminiApiError: any) {
      console.error('Error calling Google Gemini API:', geminiApiError.message);
      return new Response(JSON.stringify({ status: 'error', message: 'Failed to get response from Google Gemini API', details: geminiApiError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const aiResponse = chatCompletion.text();
    console.log('Received AI response:', aiResponse);

    return new Response(JSON.stringify({ status: 'success', response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in Google Gemini Chat Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});