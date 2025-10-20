"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
}

interface Conversation {
  contact_phone_number: string;
  last_message_body: string;
  last_message_time: string;
  whatsapp_account_id: string;
  whatsapp_account_name: string;
}

interface Message {
  id: string;
  from_phone_number: string;
  to_phone_number: string;
  message_body: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

const Inbox = () => {
  const { user } = useSession();

  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsappAccount[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchWhatsappAccounts = useCallback(async () => {
    if (!user) {
      setIsLoadingConversations(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, account_name, phone_number_id")
        .eq("user_id", user.id);

      if (error) throw error;
      setWhatsappAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching WhatsApp accounts:", error.message);
      showError("Failed to load WhatsApp accounts.");
      setWhatsappAccounts([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user || whatsappAccounts.length === 0) {
      setIsLoadingConversations(false);
      return;
    }
    setIsLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .rpc('get_latest_whatsapp_conversations', { p_user_id: user.id });

      if (error) throw error;

      const formattedConversations: Conversation[] = data.map((conv: any) => ({
        contact_phone_number: conv.contact_phone_number,
        last_message_body: conv.last_message_body,
        last_message_time: conv.last_message_time,
        whatsapp_account_id: conv.whatsapp_account_id,
        whatsapp_account_name: conv.whatsapp_account_name,
      }));
      setConversations(formattedConversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error.message);
      showError("Failed to load conversations.");
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, whatsappAccounts]);

  const fetchMessages = useCallback(async (conversation: Conversation) => {
    if (!user) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("whatsapp_account_id", conversation.whatsapp_account_id)
        .or(`from_phone_number.eq.${conversation.contact_phone_number},to_phone_number.eq.${conversation.contact_phone_number}`)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error.message);
      showError("Failed to load messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWhatsappAccounts();
    } else {
      setIsLoadingConversations(false);
    }
  }, [user, fetchWhatsappAccounts]);

  useEffect(() => {
    if (user && whatsappAccounts.length > 0) {
      fetchConversations();
    } else if (user && whatsappAccounts.length === 0) {
      setIsLoadingConversations(false);
    }
  }, [whatsappAccounts, user, fetchConversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!user || !selectedConversation) return;

    const channel = supabase
      .channel(`messages_for_conversation_${selectedConversation.whatsapp_account_id}_${selectedConversation.contact_phone_number}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Check if the new message belongs to the currently selected conversation
          const isRelevant =
            (newMessage.whatsapp_account_id === selectedConversation.whatsapp_account_id &&
              (newMessage.from_phone_number === selectedConversation.contact_phone_number ||
               newMessage.to_phone_number === selectedConversation.contact_phone_number));

          if (isRelevant) {
            setMessages((prevMessages) => [...prevMessages, newMessage]);
            fetchConversations(); // Refresh conversations to update last message preview
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation, fetchConversations]);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    const whatsappAccount = whatsappAccounts.find(acc => acc.id === selectedConversation.whatsapp_account_id);
    if (!whatsappAccount) {
      showError("WhatsApp account not found for sending message.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          toPhoneNumber: selectedConversation.contact_phone_number,
          messageBody: newMessage.trim(),
          whatsappAccountId: selectedConversation.whatsapp_account_id,
          userId: user.id,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      showSuccess("Message sent successfully!");
      setNewMessage("");
      // Messages will be updated via realtime subscription, no need to fetchMessages here
      // Conversations will be updated via realtime subscription, no need to fetchConversations here
    } catch (error: any) {
      console.error("Error sending message:", error.message);
      showError(`Failed to send message: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-4">WhatsApp Inbox</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
          <div className="p-4 text-lg font-semibold">Conversations</div>
          <Separator />
          {isLoadingConversations ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations yet.</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={`${conv.whatsapp_account_id}-${conv.contact_phone_number}`}
                className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selectedConversation?.contact_phone_number === conv.contact_phone_number &&
                  selectedConversation?.whatsapp_account_id === conv.whatsapp_account_id
                    ? 'bg-blue-50 dark:bg-blue-900'
                    : ''
                }`}
                onClick={() => handleConversationSelect(conv)}
              >
                <User className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 p-1 mr-3" />
                <div className="flex-1">
                  <p className="font-medium">{conv.contact_phone_number}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.last_message_body}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {conv.whatsapp_account_name} - {format(new Date(conv.last_message_time), 'MMM d, HH:mm')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Area */}
        <div className="flex flex-col flex-1 bg-gray-50 dark:bg-gray-900">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
                <MessageCircle className="h-6 w-6 text-green-500 mr-3" />
                <h2 className="text-xl font-semibold">{selectedConversation.contact_phone_number}</h2>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({selectedConversation.whatsapp_account_name})
                </span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {isLoadingMessages ? (
                  <div className="text-center text-gray-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500">No messages in this conversation.</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.direction === 'outgoing'
                            ? 'bg-blue-500 text-white rounded-br-none'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                        }`}
                      >
                        <p>{msg.message_body}</p>
                        <p className="text-xs mt-1 opacity-75">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} /> {/* Scroll target */}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 mr-2"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;