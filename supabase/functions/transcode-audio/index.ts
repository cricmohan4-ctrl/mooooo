import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Transcode Audio Function received request ---');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webmAudioUrl, userId, originalMediaType } = await req.json(); // Now receiving originalMediaType

    if (!webmAudioUrl || !userId || !originalMediaType) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing webmAudioUrl, userId, or originalMediaType' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Received audio for processing: ${webmAudioUrl} (Type: ${originalMediaType}) for user ${userId}`);

    // --- PASSTHROUGH LOGIC ---
    // This function now acts as a passthrough, relying on the client-side
    // MediaRecorder to produce a WhatsApp-compatible format (like OGG Opus).
    // If the client-side recording is in a compatible format, it should work.
    // If not, a dedicated external transcoding service would be required here.

    const transcodedAudioUrl = webmAudioUrl; // Pass through the original uploaded URL
    const transcodedMediaType = originalMediaType; // Pass through the original MIME type

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