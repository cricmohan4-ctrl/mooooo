import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Transcode Audio Function received request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2)); // Log all headers

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json(); // Parse the JSON body
    console.log('Transcode Audio Function received request body:', JSON.stringify(requestBody, null, 2)); // Log the entire body

    const { webmAudioUrl, userId, originalMediaType } = requestBody; // Destructure from the parsed body

    if (!webmAudioUrl || !userId || !originalMediaType) {
      console.error('Validation failed: Missing webmAudioUrl, userId, or originalMediaType in received body.');
      return new Response(JSON.stringify({ status: 'error', message: 'Missing webmAudioUrl, userId, or originalMediaType' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Received audio for processing: ${webmAudioUrl} (Type: ${originalMediaType}) for user ${userId}`);

    // --- PASSTHROUGH LOGIC ---
    const transcodedAudioUrl = webmAudioUrl;
    const transcodedMediaType = originalMediaType;

    console.log(`Returning audio URL: ${transcodedAudioUrl}, Type: ${transcodedMediaType}`);

    return new Response(JSON.stringify({
      status: 'success',
      transcodedAudioUrl: transcodedAudioUrl,
      transcodedMediaType: transcodedMediaType,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in transcode-audio Edge Function:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});