import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.15.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

    const payload = await req.json();
    const { message, whatsappAccountId, preferredLanguage } = payload; // Expect whatsappAccountId and preferredLanguage from the payload

    if (!message) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing message in payload.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Initialize Supabase client with service role key to fetch account details
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let systemInstruction = "You are a helpful customer service assistant for a business selling plastic mobile covers with customer photos. You must answer in the language the user asks in. The price for Cash on Delivery (COD) is 220. The price for prepaid orders is 150. All orders are delivered within 7 days."; // Default instruction

    if (whatsappAccountId) {
      const { data: accountData, error: accountError } = await supabaseServiceRoleClient
        .from('whatsapp_accounts')
        .select('gemini_system_instruction')
        .eq('id', whatsappAccountId)
        .single();

      if (accountError) {
        console.error('Error fetching Gemini system instruction for account:', accountError.message);
      } else if (accountData?.gemini_system_instruction) {
        systemInstruction = accountData.gemini_system_instruction;
        console.log('Using custom Gemini system instruction for account:', whatsappAccountId);
      } else {
        console.log('No custom Gemini system instruction found for account, using default.');
      }
    } else {
      console.log('No whatsappAccountId provided, using default Gemini system instruction.');
    }

    // Append language instruction based on preferredLanguage
    if (preferredLanguage === 'hi') {
      systemInstruction += " Respond strictly in Hindi.";
    } else if (preferredLanguage === 'kn') {
      systemInstruction += " Respond strictly in Kannada.";
    } else {
      systemInstruction += " Respond in the language the user asks in.";
    }
    console.log('Final System Instruction:', systemInstruction);


    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

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