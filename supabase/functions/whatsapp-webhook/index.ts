import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import OpenAI from 'https://esm.sh/openai@4.52.7'; // Corrected import path

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

    const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN'); // Get token from environment variable

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed: Invalid mode or token.');
      return new Response('Verification token mismatch', { status: 403 });
    }
  }
  // --- END: Meta Webhook Verification Logic ---

  // --- START: Existing POST request logic for actual messages ---
  try {
    // Create a Supabase client with the anon key for general operations (e.g., inserting incoming messages)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create a Supabase client with the service role key to bypass RLS for specific queries
    const supabaseServiceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Received WhatsApp webhook payload:', JSON.stringify(payload, null, 2));

    const messageEntry = payload.entry?.[0];
    const messageChange = messageEntry?.changes?.[0];
    const messageValue = messageChange?.value;
    const incomingMessage = messageValue?.messages?.[0];
    const whatsappBusinessAccountId = messageValue?.metadata?.phone_number_id;
    const whatsappBusinessPhoneNumber = messageValue?.metadata?.display_phone_number;

    if (!incomingMessage || !whatsappBusinessAccountId || !whatsappBusinessPhoneNumber) {
      console.log('No incoming message, account ID, or phone number in payload. Returning 200.');
      return new Response(JSON.stringify({ status: 'success', message: 'No message or account info to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let incomingText = "";
    let messageType = incomingMessage.type;
    let mediaUrl: string | null = null;
    let mediaCaption: string | null = null;

    if (incomingMessage.type === 'text') {
      incomingText = incomingMessage.text.body;
    } else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'button_reply') {
      incomingText = incomingMessage.interactive.button_reply.payload;
    } else if (['image', 'audio', 'video', 'document'].includes(incomingMessage.type)) {
      // Handle media messages
      const mediaId = incomingMessage[incomingMessage.type]?.id;
      if (mediaId) {
        // Fetch media URL from Meta API
        const { data: accountData, error: accountError } = await supabaseServiceRoleClient
          .from('whatsapp_accounts')
          .select('access_token')
          .eq('phone_number_id', whatsappBusinessAccountId)
          .single();

        if (accountError || !accountData) {
          console.error('Error fetching WhatsApp account access token for media download:', accountError?.message);
          // Proceed without media if token not found
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
            incomingText = `[${incomingMessage.type} message]`; // Placeholder text for media
          } else {
            console.error('Error fetching media URL from Meta API:', mediaData);
          }
        }
      }
    } else {
      console.log(`Unhandled message type: ${incomingMessage.type}`);
      incomingText = `[${incomingMessage.type} message]`;
    }

    const fromPhoneNumber = incomingMessage.from;

    console.log(`Processing message from ${fromPhoneNumber} to ${whatsappBusinessAccountId}: "${incomingText}"`);

    // Use supabaseServiceRoleClient to fetch account data, bypassing RLS
    const { data: accountData, error: accountError } = await supabaseServiceRoleClient
      .from('whatsapp_accounts')
      .select('id, user_id, access_token')
      .eq('phone_number_id', whatsappBusinessAccountId)
      .single();

    if (accountError || !accountData) {
      console.error('Error fetching WhatsApp account or user_id:', accountError?.message);
      return new Response(JSON.stringify({ status: 'error', message: 'WhatsApp account not found or user_id missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const userId = accountData.user_id;
    const whatsappAccessToken = accountData.access_token;
    const whatsappAccountId = accountData.id;

    // Save incoming message (still using supabaseClient as it's user-initiated and RLS should apply)
    const { error: insertIncomingError } = await supabaseClient
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
      // Update or create conversation entry for incoming message
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

    // Function to send WhatsApp message
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

      console.log(`Sending ${type} message to ${to} using account ${whatsappBusinessAccountId}`);
      const response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();
      if (!response.ok) {
        console.error(`Error sending WhatsApp ${type} message:`, responseData);
      } else {
        console.log(`WhatsApp ${type} message sent successfully:`, responseData);
      }

      // Save outgoing message using supabaseServiceRoleClient to bypass RLS
      const { error: insertOutgoingError } = await supabaseServiceRoleClient
        .from('whatsapp_messages')
        .insert({
          user_id: userId,
          whatsapp_account_id: whatsappAccountId,
          from_phone_number: whatsappBusinessPhoneNumber,
          to_phone_number: to,
          message_body: type === 'text' ? content.body : `[${type} message]`,
          message_type: type,
          direction: 'outgoing',
          media_url: content.mediaUrl || null,
          media_caption: content.caption || null,
        });

      if (insertOutgoingError) {
        console.error('Error saving outgoing message:', insertOutgoingError.message);
      } else {
        console.log('Outgoing message saved to database.');
        // Update or create conversation entry for outgoing message
        await supabaseServiceRoleClient
          .from('whatsapp_conversations')
          .upsert(
            {
              user_id: userId,
              whatsapp_account_id: whatsappAccountId,
              contact_phone_number: to,
              last_message_at: new Date().toISOString(),
              last_message_body: type === 'text' ? content.body : `[${type} message]`,
            },
            { onConflict: 'whatsapp_account_id,contact_phone_number' }
          );
      }
    };

    // --- Flow Logic ---
    let currentConversation = null;
    const { data: conversationData, error: convError } = await supabaseServiceRoleClient
      .from('whatsapp_conversations')
      .select('*')
      .eq('whatsapp_account_id', whatsappAccountId)
      .eq('contact_phone_number', fromPhoneNumber)
      .single();

    if (convError && convError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching conversation:', convError.message);
    } else if (conversationData) {
      currentConversation = conversationData;
    }

    let responseSent = false;

    if (currentConversation && currentConversation.current_flow_id && currentConversation.current_node_id) {
      console.log(`Active flow detected: ${currentConversation.current_flow_id}, current node: ${currentConversation.current_node_id}`);
      // Load flow data
      const { data: flowData, error: flowError } = await supabaseServiceRoleClient
        .from('chatbot_flows')
        .select('flow_data')
        .eq('id', currentConversation.current_flow_id)
        .single();

      if (flowError || !flowData?.flow_data) {
        console.error('Error fetching flow data:', flowError?.message);
        // Reset conversation if flow data is invalid
        await supabaseServiceRoleClient
          .from('whatsapp_conversations')
          .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
          .eq('id', currentConversation.id);
      } else {
        const flow = flowData.flow_data as any;
        const nodes = flow.nodes || [];
        const edges = flow.edges || [];

        const currentNode = nodes.find((n: any) => n.id === currentConversation.current_node_id);

        if (currentNode && currentNode.type === 'incomingMessageNode') {
          const expectedMessage = currentNode.data.expectedMessage?.toLowerCase();
          if (expectedMessage && incomingText.toLowerCase() === expectedMessage) {
            console.log(`Incoming message "${incomingText}" matched expected message "${expectedMessage}" for node ${currentNode.id}`);
            // Find next node
            const outgoingEdge = edges.find((e: any) => e.source === currentNode.id);
            if (outgoingEdge) {
              const nextNode = nodes.find((n: any) => n.id === outgoingEdge.target);
              if (nextNode) {
                console.log('Transitioning to next node:', nextNode.id, nextNode.type);
                // Process next node
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
                }
                // Update conversation state
                await supabaseServiceRoleClient
                  .from('whatsapp_conversations')
                  .update({ current_node_id: nextNode.id, last_message_at: new Date().toISOString() })
                  .eq('id', currentConversation.id);
              } else {
                console.warn('Next node not found in flow:', outgoingEdge.target);
              }
            } else {
              console.warn('No outgoing edge from current incomingMessageNode:', currentNode.id);
            }
          } else {
            console.log(`Incoming message "${incomingText}" did NOT match expected message "${expectedMessage}" for node ${currentNode.id}.`);
            // Re-send current node's message or a "didn't understand" message
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: `I'm sorry, I was expecting "${expectedMessage}". Please try again.` });
            responseSent = true;
          }
        } else {
          console.log(`Current node ${currentNode?.id} is not an incomingMessageNode or not found. Falling back to rules.`);
          // If current node is not an incoming message node, or if it's a message node and we're still here,
          // it means the flow might be stuck or completed. Reset flow.
          await supabaseServiceRoleClient
            .from('whatsapp_conversations')
            .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
            .eq('id', currentConversation.id);
        }
      }
    }

    // If no response was sent by flow logic, check chatbot rules
    if (!responseSent) {
      const { data: rules, error: rulesError } = await supabaseServiceRoleClient
        .from('chatbot_rules')
        .select('trigger_value, trigger_type, response_message, buttons, flow_id, use_ai_response') // Select use_ai_response
        .eq('whatsapp_account_id', whatsappAccountId);

      if (rulesError) {
        console.error('Error fetching chatbot rules:', rulesError.message);
      }

      let matchedRule = null;
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
          matchedRule = rule;
          break;
        }
      }

      if (matchedRule) {
        if (matchedRule.use_ai_response) {
          console.log(`Chatbot rule matched with AI response enabled. Generating AI response.`);
          // Fetch OpenAI config for this account
          const { data: openaiConfig, error: openaiConfigError } = await supabaseServiceRoleClient
            .from('openai_configs')
            .select('openai_api_key, is_enabled, system_prompt')
            .eq('whatsapp_account_id', whatsappAccountId)
            .eq('user_id', userId)
            .single();

          if (openaiConfigError && openaiConfigError.code !== 'PGRST116') {
            console.error('Error fetching OpenAI config for rule AI response:', openaiConfigError.message);
          }

          if (openaiConfig?.is_enabled && openaiConfig?.openai_api_key) {
            try {
              const openai = new OpenAI({ apiKey: openaiConfig.openai_api_key });

              // Fetch recent messages for context
              const { data: recentMessages, error: messagesError } = await supabaseServiceRoleClient
                .from('whatsapp_messages')
                .select('message_body, direction')
                .eq('whatsapp_account_id', whatsappAccountId)
                .or(`from_phone_number.eq.${fromPhoneNumber},to_phone_number.eq.${fromPhoneNumber}`)
                .order('created_at', { ascending: true })
                .limit(10); // Get last 10 messages for context

              if (messagesError) {
                console.error('Error fetching recent messages for AI context:', messagesError.message);
              }

              const messagesForAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

              if (openaiConfig.system_prompt) {
                messagesForAI.push({ role: 'system', content: openaiConfig.system_prompt });
              }

              if (recentMessages) {
                for (const msg of recentMessages) {
                  if (msg.direction === 'incoming') {
                    messagesForAI.push({ role: 'user', content: msg.message_body });
                  } else if (msg.direction === 'outgoing') {
                    messagesForAI.push({ role: 'assistant', content: msg.message_body });
                  }
                }
              }
              
              // Add the current incoming message
              messagesForAI.push({ role: 'user', content: incomingText });

              const chatCompletion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: messagesForAI,
                max_tokens: 150,
              });

              const aiResponse = chatCompletion.choices[0].message.content;
              if (aiResponse) {
                await sendWhatsappMessage(fromPhoneNumber, 'text', { body: aiResponse });
                responseSent = true;
              }
            } catch (aiError: any) {
              console.error('Error calling OpenAI API for rule AI response:', aiError.message);
              await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I'm having trouble with my AI assistant for this rule right now." });
              responseSent = true;
            }
          } else {
            console.warn('AI assistant not enabled or API key missing for rule AI response.');
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, the AI assistant for this rule is not configured correctly." });
            responseSent = true;
          }
        } else if (matchedRule.flow_id) {
          console.log(`Chatbot rule matched to start flow: ${matchedRule.flow_id}`);
          // Load flow data to find the start node
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
              }
              // Update or create conversation state
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
          responseSent = true; // A flow was matched and attempted to start
        } else if (matchedRule.response_message.length > 0 || (matchedRule.buttons && matchedRule.buttons.length > 0)) {
          // Send static response if no flow is linked and AI is not used
          for (const responseMessage of matchedRule.response_message) {
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: responseMessage });
          }

          if (matchedRule.buttons && matchedRule.buttons.length > 0) {
            const interactiveButtons = matchedRule.buttons.map(btn => ({
              type: "reply",
              reply: { id: btn.payload, title: btn.text },
            }));

            const interactiveBodyText = matchedRule.response_message.length > 0
              ? matchedRule.response_message[matchedRule.response_message.length - 1]
              : "Please choose an option:";

            await sendWhatsappMessage(fromPhoneNumber, 'interactive', {
              type: 'button',
              body: { text: interactiveBodyText },
              action: { buttons: interactiveButtons },
            });
          }
          // Ensure conversation state is reset if it was previously in a flow
          if (currentConversation) {
            await supabaseServiceRoleClient
              .from('whatsapp_conversations')
              .update({ current_flow_id: null, current_node_id: null, updated_at: new Date().toISOString() })
              .eq('id', currentConversation.id);
          }
          responseSent = true; // A rule was matched and a static response was sent
        }
      }
    }

    // If no response was sent by flows or rules, check for general AI assistant fallback
    if (!responseSent) {
      const { data: openaiConfig, error: openaiConfigError } = await supabaseServiceRoleClient
        .from('openai_configs')
        .select('openai_api_key, is_enabled, system_prompt')
        .eq('whatsapp_account_id', whatsappAccountId)
        .eq('user_id', userId)
        .single();

      if (openaiConfigError && openaiConfigError.code !== 'PGRST116') {
        console.error('Error fetching OpenAI config for general fallback:', openaiConfigError.message);
      }

      if (openaiConfig?.is_enabled && openaiConfig?.openai_api_key) {
        console.log('General AI assistant fallback is enabled. Generating response...');
        try {
          const openai = new OpenAI({ apiKey: openaiConfig.openai_api_key });

          // Fetch recent messages for context
          const { data: recentMessages, error: messagesError } = await supabaseServiceRoleClient
            .from('whatsapp_messages')
            .select('message_body, direction')
            .eq('whatsapp_account_id', whatsappAccountId)
            .or(`from_phone_number.eq.${fromPhoneNumber},to_phone_number.eq.${fromPhoneNumber}`)
            .order('created_at', { ascending: true })
            .limit(10); // Get last 10 messages for context

          if (messagesError) {
            console.error('Error fetching recent messages for AI context:', messagesError.message);
          }

          const messagesForAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

          if (openaiConfig.system_prompt) {
            messagesForAI.push({ role: 'system', content: openaiConfig.system_prompt });
          }

          if (recentMessages) {
            for (const msg of recentMessages) {
              if (msg.direction === 'incoming') {
                messagesForAI.push({ role: 'user', content: msg.message_body });
              } else if (msg.direction === 'outgoing') {
                messagesForAI.push({ role: 'assistant', content: msg.message_body });
              }
            }
          }
          
          // Add the current incoming message
          messagesForAI.push({ role: 'user', content: incomingText });

          const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messagesForAI,
            max_tokens: 150,
          });

          const aiResponse = chatCompletion.choices[0].message.content;
          if (aiResponse) {
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: aiResponse });
            responseSent = true;
          }
        } catch (aiError: any) {
          console.error('Error calling OpenAI API for general fallback:', aiError.message);
          await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I'm having trouble connecting to my AI assistant right now." });
          responseSent = true;
        }
      }
    }

    // If still no response, send a default "didn't understand" message
    if (!responseSent) {
      await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, I didn't understand that. Please try again." });
    }

    return new Response(JSON.stringify({ status: 'success', message: 'Webhook processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Internal server error in Edge Function', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});