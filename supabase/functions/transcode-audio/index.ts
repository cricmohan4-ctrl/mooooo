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
    const { webmAudioUrl, userId } = await req.json();

    if (!webmAudioUrl || !userId) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing webmAudioUrl or userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Received WebM audio for processing: ${webmAudioUrl} for user ${userId}`);

    // --- CURRENT BEHAVIOR: Pass through original WebM URL ---
    // This demonstrates that the system is correctly handling the user's recorded audio.
    // However, this WebM format is likely NOT WhatsApp compatible, and delivery will probably fail.
    //
    // For a permanent fix, you would integrate an external audio transcoding service here
    // (e.g., Cloudinary, Mux, or a custom serverless function with FFmpeg)
    // to convert the WebM audio to a WhatsApp-compatible format (like OGG Opus or MP4 AAC)
    // and then return the URL of the *transcoded* file.

    const transcodedAudioUrl = webmAudioUrl; // Simply pass through the original WebM URL
    const transcodedMediaType = 'audio/webm'; // The original media type

    console.log(`Returning original audio URL: ${transcodedAudioUrl}, Type: ${transcodedMediaType}`);

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