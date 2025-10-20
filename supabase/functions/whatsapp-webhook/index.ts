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

    if (incomingMessage.type === 'text') {
      incomingText = incomingMessage.text.body;
    } else if (incomingMessage.type === 'interactive' && incomingMessage.interactive.type === 'button_reply') {
      incomingText = incomingMessage.interactive.button_reply.payload;
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
      });

    if (insertIncomingError) {
      console.error('Error saving incoming message:', insertIncomingError.message);
    } else {
      console.log('Incoming message saved to database.');
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
          message_body: type === 'text' ? content.body : JSON.stringify(content),
          message_type: type,
          direction: 'outgoing',
        });

      if (insertOutgoingError) {
        console.error('Error saving outgoing message:', insertOutgoingError.message);
      } else {
        console.log('Outgoing message saved to database.');
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
        .select('trigger_value, trigger_type, response_message, buttons, flow_id')
        .eq('whatsapp_account_id', whatsappAccountId);

      if (rulesError) {
        console.error('Error fetching chatbot rules:', rulesError.message);
      }

      let matchedResponseMessages: string[] = ["I'm sorry, I didn't understand that. Please try again."];
      let matchedButtons: { text: string; payload: string }[] | null = null;
      let matchedFlowId: string | null = null;

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
          matchedResponseMessages = rule.response_message as string[];
          matchedButtons = rule.buttons as { text: string; payload: string }[] | null;
          matchedFlowId = rule.flow_id;
          break;
        }
      }

      if (matchedFlowId) {
        console.log(`Chatbot rule matched to start flow: ${matchedFlowId}`);
        // Load flow data to find the start node
        const { data: flowData, error: flowError } = await supabaseServiceRoleClient
          .from('chatbot_flows')
          .select('flow_data')
          .eq('id', matchedFlowId)
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
              // If start node has no outgoing edge, it's just a trigger.
              // We might need a more robust way to define the actual first message.
              // For now, if no edge, no message is sent from the flow start.
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
                  current_flow_id: matchedFlowId,
                  current_node_id: firstNodeId,
                  last_message_at: new Date().toISOString(),
                },
                { onConflict: 'whatsapp_account_id,contact_phone_number' }
              );
            if (upsertConvError) console.error('Error upserting conversation for new flow:', upsertConvError.message);
          } else {
            await sendWhatsappMessage(fromPhoneNumber, 'text', { body: "I'm sorry, the flow could not be started correctly." });
          }
        }
      } else {
        // Send static response if no flow is linked
        for (const responseMessage of matchedResponseMessages) {
          await sendWhatsappMessage(fromPhoneNumber, 'text', { body: responseMessage });
        }

        if (matchedButtons && matchedButtons.length > 0) {
          const interactiveButtons = matchedButtons.map(btn => ({
            type: "reply",
            reply: { id: btn.payload, title: btn.text },
          }));

          const interactiveBodyText = matchedResponseMessages.length > 0
            ? matchedResponseMessages[matchedResponseMessages.length - 1]
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