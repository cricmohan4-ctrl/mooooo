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

    const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed: Invalid mode or token.');
      return new Response('Verification token mismatch', { status: 403 });
    }
  }
  // --- END: Meta Webhook Verification Logic ---

  // --- START: POST request logic for actual messages ---
  if (req.method === 'POST') {
    // Immediately return 200 OK to Meta to prevent retries.
    // The actual processing will happen in the background.
    const initialResponse = new Response(JSON.stringify({ status: 'accepted', message: 'Webhook payload received, processing asynchronously.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // Clone the request body so it can be read asynchronously later
    const clonedReq = req.clone();

    // Start an asynchronous task for processing the webhook payload
    (async () => {
      try {
        // Use service role client for all database operations within the webhook
        // as it's a backend process and not directly tied to an authenticated user session.
        const supabaseServiceRoleClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const payload = await clonedReq.json();
        console.log('Received WhatsApp webhook payload (async processing):', JSON.stringify(payload, null, 2));

        const messageEntry = payload.entry?.[0];
        const messageChange = messageEntry?.changes?.[0];
        const messageValue = messageChange?.value;
        const incomingMessage = messageValue?.messages?.[0];
        const whatsappBusinessAccountId = messageValue?.metadata?.phone_number_id;
        const whatsappBusinessPhoneNumber = messageValue?.metadata?.display_phone_number;

        console.log('Parsed messageEntry:', JSON.stringify(messageEntry));
        console.log('Parsed messageChange:', JSON.stringify(messageChange));
        console.log('Parsed messageValue:', JSON.stringify(messageValue));
        console.log('Parsed incomingMessage:', JSON.stringify(incomingMessage));
        console.log('Parsed whatsappBusinessAccountId:', whatsappBusinessAccountId);
        console.log('Parsed whatsappBusinessPhoneNumber:', whatsappBusinessPhoneNumber);

        // Check for 'status' updates (e.g., message delivered, read) and ignore them for now
        if (messageValue?.statuses) {
          console.log('Received status update, ignoring for now:', JSON.stringify(messageValue.statuses));
          return; // Exit async processing
        }

        if (!incomingMessage || !whatsappBusinessAccountId || !whatsappBusinessPhoneNumber) {
          console.log('No incoming message, account ID, or phone number in payload. Skipping processing.');
          return; // Exit async processing
        }

        let incomingText = "";
        let messageType = incomingMessage.type;
        let mediaUrl: string | null = null;
        let mediaCaption: string | null = null;

        if (incomingMessage.type === 'text') {
          incomingText = incomingMessage.text?.body ?? ""; // Use optional chaining and nullish coalescing
        } else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'button_reply') {
          incomingText = incomingMessage.interactive?.button_reply?.payload ?? ""; // Use optional chaining and nullish coalescing
        } else if (['image', 'audio', 'video', 'document'].includes(incomingMessage.type)) {
          const mediaId = incomingMessage[incomingMessage.type]?.id;
          if (mediaId) {
            const { data: accountData, error: accountError } = await supabaseServiceRoleClient
              .from('whatsapp_accounts')
              .select('access_token')
              .eq('phone_number_id', whatsappBusinessAccountId)
              .single();

            if (accountError || !accountData) {
              console.error('Error fetching WhatsApp account access token for media download:', accountError?.message);
            } else {
              const mediaApiUrl = `https://graph.facebook.com/v19.0/${mediaId}`;
              const mediaResponse = await fetch(mediaApiUrl, {
                headers: {
                  'Authorization': `Bearer ${accountData.access_token}`,
                },
              });
              const mediaData = await mediaResponse.json();
              if (mediaResponse.ok && mediaData.url) {
                mediaUrl = mediaData.url;
                mediaCaption = incomingMessage[incomingMessage.type]?.caption || null;
                incomingText = `[${incomingMessage.type} message]${mediaCaption ? `: ${mediaCaption}` : ''}`; // Ensure incomingText is a string
              } else {
                console.error('Error fetching media URL from Meta API:', mediaData);
                incomingText = `[${incomingMessage.type} message]`; // Ensure incomingText is a string even on error
              }
            }
          } else {
            incomingText = `[${incomingMessage.type} message]`; // Ensure incomingText is a string if mediaId is missing
          }
        } else {
          console.log(`Unhandled message type: ${incomingMessage.type}`);
          incomingText = `[${incomingMessage.type} message]`; // Ensure incomingText is a string
        }

        const fromPhoneNumber = incomingMessage.from;

        console.log(`Processing message from ${fromPhoneNumber} to ${whatsappBusinessAccountId}: "${incomingText}"`);

        const { data: accountData, error: accountError } = await supabaseServiceRoleClient
          .from('whatsapp_accounts')
          .select('id, user_id, access_token')
          .eq('phone_number_id', whatsappBusinessAccountId)
          .single();

        if (accountError || !accountData) {
          console.error('Error fetching WhatsApp account or user_id:', accountError?.message);
          return; // Exit async processing
        }

        const userId = accountData.user_id;
        const whatsappAccessToken = accountData.access_token;
        const whatsappAccountId = accountData.id;

        console.log('Fetched userId:', userId);
        console.log('Fetched whatsappAccountId:', whatsappAccountId);

        // Use supabaseServiceRoleClient for inserting incoming messages
        const { error: insertIncomingError } = await supabaseServiceRoleClient
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            whatsapp_account_id: whatsappAccountId,
            from_phone_number: fromPhoneNumber,
            to_phone_number: whatsappBusinessPhoneNumber,
            message_body: incomingText,
            message_type: messageType,
            direction: 'incoming',
            media_url: mediaUrl,
            media_caption: mediaCaption,
          });

        if (insertIncomingError) {
          console.error('Error saving incoming message:', insertIncomingError.message);
        } else {
          console.log('Incoming message saved to database.');
          await supabaseServiceRoleClient
            .from('whatsapp_conversations')
            .upsert(
              {
                user_id: userId,
                whatsapp_account_id: whatsappAccountId,
                contact_phone_number: fromPhoneNumber,
                last_message_at: new Date().toISOString(),
                last_message_body: incomingText,
              },
              { onConflict: 'whatsapp_account_id,contact_phone_number' }
            );
        }

        const sendWhatsappMessage = async (to: string, type: string, content: any) => {
          if (!whatsappAccessToken || !whatsappBusinessAccountId) {
            console.warn('No WhatsApp access token or business account ID. Cannot send message.');
            return;
          }

          const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappBusinessAccountId}/messages`;
          const body: any = {
            messaging_product: 'whatsapp',
            to: to,
            type: type,
          };

          if (type === 'text') {
            body.text = { body: content.body };
          } else if (type === 'interactive') {
            body.interactive = content;
          } else if (['image', 'audio', 'video', 'document'].includes(type)) {
            body[type] = { link: content.mediaUrl };
            if (content.caption) {
              body[type].caption = content.caption;
            }
          }

          console.log(`Attempting to send ${type} message to ${to} via WhatsApp API.`);
          console.log('WhatsApp API URL:', whatsappApiUrl);
          console.log('Request Body:', JSON.stringify(body, null, 2));

          const response = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          const responseData = await response.json();
          console.log('WhatsApp API Response Status:', response.status);
          console.log('WhatsApp API Response Data:', JSON.stringify(responseData, null, 2));

          if (!response.ok) {
            console.error(`Error sending WhatsApp ${type} message:`, responseData);
          } else {
            console.log(`WhatsApp ${type} message sent successfully.`);
          }

          const { error: insertOutgoingError } = await supabaseServiceRoleClient
            .from('whatsapp_messages')
            .insert({
              user_id: userId,
              whatsapp_account_id: whatsappAccountId,
              from_phone_number: whatsappBusinessPhoneNumber,
              to_phone_number: to,
              message_body: type === 'text' ? content.body : `[${type} message]`,
              message_type: type,
              media_url: content.mediaUrl || null,
              media_caption: content.caption || null,
              direction: 'outgoing',
            });

          if (insertOutgoingError) {
            console.error('Error saving outgoing message:', insertOutgoingError.message);
          } else {
            console.log('Outgoing message saved to database.');
            await supabaseServiceRoleClient
              .from('whatsapp_conversations')
              .upsert(
                {
                  user_id: userId,
                  whatsapp_account_id: whatsappAccountId,
                  contact_phone_number: fromPhoneNumber,
                  last_message_at: new Date().toISOString(),
                  last_message_body: type === 'text' ? content.body : `[${type} message]`,
                },
                { onConflict: 'whatsapp_account_id,contact_phone_number' }
              );
          }
        };

        // --- Conversation and Language Logic ---
        let currentConversation = null;
        const { data: conversationData, error: convError } = await supabaseServiceRoleClient
          .from('whatsapp_conversations')
          .select('*')
          .eq('whatsapp_account_id', whatsappAccountId)
          .eq('contact_phone_number', fromPhoneNumber)
          .single();

        if (convError && convError.code !== 'PGRST116') {
          console.error('Error fetching conversation:', convError.message);
        } else if (conversationData) {
          currentConversation = conversationData;
          console.log('Fetched existing conversation:', JSON.stringify(currentConversation));
        } else {
          console.log('No existing conversation found.');
        }

        let preferredLanguage = currentConversation?.preferred_language || 'en';
        let responseSent = false;

        // Check for language change keywords
        const lowerCaseIncomingText = incomingText.trim().toLowerCase();
        console.log(`Normalized incoming text for language detection: "${lowerCaseIncomingText}"`);

        // Updated to match keywords without a period and include English
        if (lowerCaseIncomingText === 'hindi' || lowerCaseIncomingText === 'kannada' || lowerCaseIncomingText === 'telugu' || lowerCaseIncomingText === 'english') {
          let newPreferredLanguage = 'en';
          let confirmationMessage = "Hello! I will now respond in English."; // Default

          if (lowerCaseIncomingText === 'hindi') {
            newPreferredLanguage = 'hi';
            confirmationMessage = "नमस्ते! अब मैं हिंदी में जवाब दूंगा।";
          } else if (lowerCaseIncomingText === 'kannada') {
            newPreferredLanguage = 'kn';
            confirmationMessage = "ನಮಸ್ಕಾರ! ಈಗ ನಾನು ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸುತ್ತೇನೆ.";
          } else if (lowerCaseIncomingText === 'telugu') {
            newPreferredLanguage = 'te';
            confirmationMessage = "నಮస్కారం! ಈಗ ನಾನು తెలుగులో సమాధానం ಇస్తాను.";
          } else if (lowerCaseIncomingText === 'english') {
            newPreferredLanguage = 'en';
            confirmationMessage = "Hello! I will now respond in English.";
          }

          console.log(`Language change detected. New preferred language: ${newPreferredLanguage}, Confirmation message: "${confirmationMessage}"`);

          // Update or insert conversation with new preferred language
          const { error: upsertLangError } = await supabaseServiceRoleClient
            .from('whatsapp_conversations')
            .upsert(
              {
                user_id: userId,
                whatsapp_account_id: whatsappAccountId,
                contact_phone_number: fromPhoneNumber,
                preferred_language: newPreferredLanguage,
                last_message_at: new Date().toISOString(), // Update last message time
                last_message_body: incomingText, // Update last message body
              },
              { onConflict: 'whatsapp_account_id,contact_phone_number' }
            );

          if (upsertLangError) {
            console.error('Error upserting conversation for language change:', upsertLangError.message);
            // Fallback to English confirmation if DB update fails
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "Sorry, I couldn't update your language preference. Please try again." });
          } else {
            console.log('Conversation language preference updated successfully.');
            preferredLanguage = newPreferredLanguage; // Update local variable for subsequent AI calls
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: confirmationMessage });
            responseSent = true;
            console.log('Language change confirmation sent. ResponseSent set to true.');
          }
        }

        // Priority 1: Check for active flow
        if (!responseSent && currentConversation && currentConversation.current_flow_id && currentConversation.current_node_id) {
          console.log(`Active flow detected: ${currentConversation.current_flow_id}, current node: ${currentConversation.current_node_id}`);
          const { data: flowData, error: flowError } = await supabaseServiceRoleClient
            .from('chatbot_flows')
            .select('flow_data')
            .eq('id', currentConversation.current_flow_id)
            .single();

          if (flowError || !flowData?.flow_data) {
            console.error('Error fetching flow data:', flowError?.message);
            await supabaseServiceRoleClient
              .from('whatsapp_conversations')
              .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
              .eq('id', currentConversation.id);
          } else {
            const flow = flowData.flow_data as any;
            const nodes = flow.nodes || [];
            const edges = flow.edges || [];

            const currentNode = nodes.find((n: any) => n.id === currentConversation.current_node_id);
            console.log('Current node in active flow:', JSON.stringify(currentNode));

            if (currentNode && currentNode.type === 'incomingMessageNode') {
              const expectedInputType = currentNode.data.expectedInputType || 'any';
              const promptMessage = currentNode.data.prompt || "Please provide the requested information.";
              console.log(`IncomingMessageNode: Expected input type: ${expectedInputType}, Prompt: "${promptMessage}"`);

              let inputMatchesExpectedType = false;
              if (expectedInputType === 'any') {
                inputMatchesExpectedType = true; // Any input is fine
              } else if (expectedInputType === 'text' && messageType === 'text') {
                inputMatchesExpectedType = true;
              } else if (expectedInputType === 'image' && messageType === 'image') {
                inputMatchesExpectedType = true;
              }
              console.log(`Incoming message type: ${messageType}, Input matches expected type: ${inputMatchesExpectedType}`);


              if (inputMatchesExpectedType) {
                console.log(`Incoming message type "${messageType}" matched expected input type "${expectedInputType}" for node ${currentNode.id}`);
                const outgoingEdge = edges.find((e: any) => e.source === currentNode.id);
                console.log('Outgoing edge from current node:', JSON.stringify(outgoingEdge));

                if (outgoingEdge) {
                  const nextNode = nodes.find((n: any) => n.id === outgoingEdge.target);
                  if (nextNode) {
                    console.log('Transitioning to next node:', nextNode.id, nextNode.type);
                    if (nextNode.type === 'messageNode') { 
                      await sendWhatsappMessage(fromPhoneNumber, 'text', { body: nextNode.data.message });
                      responseSent = true;
                    } else if (nextNode.type === 'buttonMessageNode') {
                      const interactiveButtons = (nextNode.data.buttons || []).map((btn: any) => ({
                        type: "reply",
                        reply: { id: btn.payload, title: btn.text },
                      }));
                      await sendWhatsappMessage(fromPhoneNumber, 'interactive', {
                        type: 'button',
                        body: { text: nextNode.data.message },
                        action: { buttons: interactiveButtons },
                      });
                      responseSent = true;
                    } else if (nextNode.type === 'incomingMessageNode') {
                      await sendWhatsappMessage(fromPhoneNumber, 'text', { body: nextNode.data.prompt });
                      responseSent = true;
                    }
                    await supabaseServiceRoleClient
                      .from('whatsapp_conversations')
                      .update({ current_node_id: nextNode.id, last_message_at: new Date().toISOString() })
                      .eq('id', currentConversation.id);
                  } else {
                    console.warn('Next node not found in flow:', outgoingEdge.target);
                    // End flow if next node is not found
                    await supabaseServiceRoleClient
                      .from('whatsapp_conversations')
                      .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
                      .eq('id', currentConversation.id);
                  }
                } else {
                  console.warn('No outgoing edge from current incomingMessageNode:', currentNode.id);
                  // End flow if no outgoing edge
                  await supabaseServiceRoleClient
                    .from('whatsapp_conversations')
                    .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
                    .eq('id', currentConversation.id);
                }
              } else {
                console.log(`Current node ${currentNode?.id} is not an incomingMessageNode or not found. Falling back to rules.`);
                await supabaseServiceRoleClient
                  .from('whatsapp_conversations')
                  .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
                  .eq('id', currentConversation.id);
              }
            }
          }
        }

        // Priority 2: Rule Matching Logic
        if (!responseSent) {
          const { data: rules, error: rulesError } = await supabaseServiceRoleClient
            .from('chatbot_rules')
            .select('id, trigger_value, trigger_type, response_message, buttons, flow_id, use_ai_response')
            .eq('whatsapp_account_id', whatsappAccountId);

          if (rulesError) {
            console.error('Error fetching chatbot rules:', rulesError.message);
          }
          console.log('Fetched chatbot rules:', JSON.stringify(rules));

          let matchedRule = null;

          for (const rule of rules || []) {
            const triggerValue = rule.trigger_value.toLowerCase();
            const triggerType = rule.trigger_type;
            console.log(`Evaluating rule ID: ${rule.id}, Trigger Type: ${triggerType}, Trigger Value: "${triggerValue}"`);

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
              case 'AI_RESPONSE':
                // If AI_RESPONSE has a trigger value, it's a specific AI trigger
                if (triggerValue) {
                  match = lowerCaseIncomingText.includes(triggerValue);
                }
                break;
              default:
                break;
            }
            console.log(`Rule match result for rule ID ${rule.id}: ${match}`);

            if (match) {
              matchedRule = rule;
              break;
            }
          }

          // If still no specific rule matched, and there's an AI_RESPONSE rule with an empty trigger_value, use it as a general AI fallback
          if (!matchedRule) {
            const generalAIFallbackRule = (rules || []).find(rule => rule.trigger_type === 'AI_RESPONSE' && !rule.trigger_value);
            if (generalAIFallbackRule) {
              matchedRule = generalAIFallbackRule;
              console.log('Matched general AI_RESPONSE fallback rule (empty trigger_value).');
            }
          }

          // Process the matched rule
          if (matchedRule) {
            console.log('Processing matched rule:', JSON.stringify(matchedRule));
            if (matchedRule.use_ai_response) {
              console.log('Chatbot rule matched for AI Response. Invoking Gemini chat function.');
              let geminiPayload: any = {
                message: incomingText,
                whatsappAccountId: whatsappAccountId,
                preferredLanguage: preferredLanguage
              };

              if (messageType === 'audio' && mediaUrl) {
                geminiPayload.audioUrl = mediaUrl;
              }

              try {
                const geminiResponse = await supabaseServiceRoleClient.functions.invoke('gemini-chat', {
                  body: geminiPayload,
                });

                if (geminiResponse.error) {
                  console.error('Error invoking Gemini chat function:', geminiResponse.error.message);
                  await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I'm having trouble connecting to my AI at the moment." });
                  responseSent = true; 
                } else if (geminiResponse.data.status === 'success') {
                  await sendWhatsappMessage(fromPhoneNumber, 'text', { body: geminiResponse.data.response });
                  responseSent = true;
                } else {
                  console.error('Gemini chat function returned an error status:', geminiResponse.data.message);
                  await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I couldn't generate an AI response." });
                  responseSent = true; 
                }
              } catch (aiInvokeError: any) {
                console.error('Unexpected error during Gemini invocation:', aiInvokeError.message);
                await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, something went wrong while trying to get an AI response." });
                responseSent = true; 
              }
            } else if (matchedRule.flow_id) {
              console.log(`Chatbot rule matched to start flow: ${matchedRule.flow_id}`);
              const { data: flowData, error: flowError } = await supabaseServiceRoleClient
                .from('chatbot_flows')
                .select('flow_data')
                .eq('id', matchedRule.flow_id)
                .single();

              if (flowError || !flowData?.flow_data) {
                console.error('Error fetching flow data for new flow:', flowError?.message);
                await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I couldn't start that flow." });
              } else {
                const flow = flowData.flow_data as any;
                const nodes = flow.nodes || [];
                const edges = flow.edges || [];

                const startNode = nodes.find((n: any) => n.type === 'input' && n.id === 'start-node');
                let firstNodeToSend = null;
                let firstNodeId = null;

                if (startNode) {
                  const startEdge = edges.find((e: any) => e.source === startNode.id);
                  if (startEdge) {
                    firstNodeToSend = nodes.find((n: any) => n.id === startEdge.target);
                    firstNodeId = firstNodeToSend?.id;
                  } else {
                    console.warn('Start node has no outgoing edge. No initial message from flow.');
                  }
                }

                if (firstNodeToSend) {
                  if (firstNodeToSend.type === 'messageNode') { 
                    await sendWhatsappMessage(fromPhoneNumber, 'text', { body: firstNodeToSend.data.message });
                  } else if (firstNodeToSend.type === 'buttonMessageNode') {
                    const interactiveButtons = (firstNodeToSend.data.buttons || []).map((btn: any) => ({
                      type: "reply",
                      reply: { id: btn.payload, title: btn.text },
                    }));
                    await sendWhatsappMessage(fromPhoneNumber, 'interactive', {
                      type: 'button',
                      body: { text: firstNodeToSend.data.message },
                      action: { buttons: interactiveButtons },
                    });
                  } else if (firstNodeToSend.type === 'incomingMessageNode') {
                    // If the first node is an incoming message node, send its prompt
                    await sendWhatsappMessage(fromPhoneNumber, 'text', { body: firstNodeToSend.data.prompt });
                  }
                  const { error: upsertConvError } = await supabaseServiceRoleClient
                    .from('whatsapp_conversations')
                    .upsert(
                      {
                        user_id: userId,
                        whatsapp_account_id: whatsappAccountId,
                        contact_phone_number: fromPhoneNumber,
                        current_flow_id: matchedRule.flow_id,
                        current_node_id: firstNodeId,
                        last_message_at: new Date().toISOString(),
                        last_message_body: firstNodeToSend.type === 'text' ? firstNodeToSend.data.message : JSON.stringify(firstNodeToSend.data),
                      },
                      { onConflict: 'whatsapp_account_id,contact_phone_number' }
                    );
                  if (upsertConvError) console.error('Error upserting conversation for new flow:', upsertConvError.message);
                } else {
                  await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, the flow could not be started correctly." });
                }
              }
              responseSent = true;
            } else if (matchedRule.response_message.length > 0 || (matchedRule.buttons && matchedRule.buttons.length > 0)) {
              for (const responseMessage of matchedRule.response_message) {
                await sendWhatsappMessage(fromPhoneNumber, 'text', { body: responseMessage });
              }

              if (matchedRule.buttons && matchedRule.buttons.length > 0) {
                const interactiveBodyText = matchedRule.response_message.length > 0
                  ? matchedRule.response_message[matchedRule.response_message.length - 1]
                  : "Please choose an option:";

                const interactiveButtons = matchedRule.buttons.map(btn => ({
                  type: "reply",
                  reply: { id: btn.payload, title: btn.text },
                }));

                await sendWhatsappMessage(fromPhoneNumber, 'interactive', {
                  type: 'button',
                  body: { text: interactiveBodyText },
                  action: { buttons: interactiveButtons },
                });
              }
              if (currentConversation) {
                await supabaseServiceRoleClient
                  .from('whatsapp_conversations')
                  .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
                  .eq('id', currentConversation.id);
              }
              responseSent = true;
            }
          }
        }

        // Final Fallback: If no response has been sent by any rule or flow, use AI
        if (!responseSent) {
          console.log('No specific rule or flow matched. Invoking Gemini chat function as a general fallback.');
          let geminiPayload: any = {
            message: incomingText,
            whatsappAccountId: whatsappAccountId,
            preferredLanguage: preferredLanguage
          };

          if (messageType === 'audio' && mediaUrl) {
            geminiPayload.audioUrl = mediaUrl;
          }

          try {
            const geminiResponse = await supabaseServiceRoleClient.functions.invoke('gemini-chat', {
              body: geminiPayload,
            });

            if (geminiResponse.error) {
              console.error('Error invoking Gemini chat function for fallback:', geminiResponse.error.message);
              await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I'm having trouble connecting to my AI at the moment. Please try again later." });
            } else if (geminiResponse.data.status === 'success') {
              await sendWhatsappMessage(fromPhoneNumber, 'text', { body: geminiResponse.data.response });
            } else {
              console.error('Gemini chat function returned an error status for fallback:', geminiResponse.data.message);
              await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I couldn't generate an AI response for that." });
            }
            responseSent = true;
          } catch (aiFallbackError: any) {
            console.error('Unexpected error during Gemini fallback invocation:', aiFallbackError.message);
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, something went wrong while trying to get an AI response." });
            responseSent = true;
          }
        }

      } catch (error: any) {
        console.error('Error during asynchronous webhook processing:', error.message);
        // Log the error, but don't try to send a new HTTP response,
        // as the initial 200 OK has already been sent.
      }
    })();

    return initialResponse; // This returns the 200 OK immediately
  }

  // Fallback for any other unhandled methods (shouldn't be reached for GET/POST)
  return new Response('Not Found', { status: 404 });
});