"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send, Mic, Camera, Paperclip, StopCircle, PlayCircle, PauseCircle, Download, PlusCircle, Search, Tag, Zap, FileAudio, MessageSquareText, X, ListFilter, MailOpen, SquareX, Tags, Check, CheckCheck, Trash2 } from 'lucide-react'; // Added Trash2 icon
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AddNewContactDialog from '@/components/AddNewContactDialog';
import ApplyLabelsPopover from '@/components/ApplyLabelsPopover';
import LabelBadge from '@/components/LabelBadge';
import ManageQuickRepliesDialog from '@/components/ManageQuickRepliesDialog';
import BulkApplyLabelsPopover from '@/components/BulkApplyLabelsPopover';
import AttachmentOptionsDialog from '@/components/AttachmentOptionsDialog';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
}

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

interface QuickReplyItem {
  id: string;
  name: string;
  type: 'text' | 'audio';
  text_content: string | null;
  audio_url: string | null;
}

interface Conversation {
  id: string;
  contact_phone_number: string;
  last_message_body: string;
  last_message_time: string;
  whatsapp_account_id: string;
  whatsapp_account_name: string;
  unread_count: number;
  labels: (LabelItem & { applied_by_user_id: string })[];
}

interface Message {
  id: string;
  from_phone_number: string;
  to_phone_number: string;
  message_body: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
  message_type: string;
  media_url?: string | null;
  media_caption?: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  user_id?: string; // Explicitly include user_id for clarity in optimistic updates
}

const Inbox = () => {
  const { user } = useSession();
  const isMobile = useIsMobile();

  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsappAccount[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');
  const [allLabels, setAllLabels] = useState<LabelItem[]>([]);
  const [selectedLabelFilterId, setSelectedLabelFilterId] = useState<string | null>(null);
  const [isQuickRepliesPopoverOpen, setIsQuickRepliesPopoverOpen] = useState(false);
  const [dynamicQuickReplies, setDynamicQuickReplies] = useState<QuickReplyItem[]>([]);

  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [audioCaption, setAudioCaption] = useState("");

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
        .select("id, account_name, phone_number_id");

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

  const fetchAllLabels = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select('id, name, color')
        .order('name', { ascending: true });

      if (error) throw error;
      setAllLabels(data || []);
    } catch (error: any) {
      console.error("Error fetching all labels:", error.message);
      showError("Failed to load labels for filtering.");
    }
  }, [user]);

  const fetchDynamicQuickReplies = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies')
        .select('id, name, type, text_content, audio_url')
        .order('name', { ascending: true });

      if (error) throw error;
      setDynamicQuickReplies(data || []);
    } catch (error: any) {
      console.error("Error fetching dynamic quick replies:", error.message);
      showError("Failed to load quick replies.");
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user || whatsappAccounts.length === 0) {
      setIsLoadingConversations(false);
      return;
    }
    setIsLoadingConversations(true);
    try {
      const { data: convData, error: convError } = await supabase
        .rpc('get_whatsapp_conversations_with_unread_count', { p_user_id: user.id });

      if (convError) throw convError;

      const conversationIds = convData.map((conv: any) => conv.id).filter(Boolean);

      let labelsByConversationId: Record<string, (LabelItem & { applied_by_user_id: string })[]> = {};
      if (conversationIds.length > 0) {
        const { data: convLabelsData, error: convLabelsError } = await supabase
          .from('whatsapp_conversation_labels')
          .select('conversation_id, label_id, user_id, whatsapp_labels(id, name, color)')
          .in('conversation_id', conversationIds);

        if (convLabelsError) throw convLabelsError;

        labelsByConversationId = convLabelsData.reduce((acc, cl) => {
          const label = cl.whatsapp_labels as LabelItem;
          if (label) {
            if (!acc[cl.conversation_id]) {
              acc[cl.conversation_id] = [];
            }
            acc[cl.conversation_id].push({ ...label, applied_by_user_id: cl.user_id });
          }
          return acc;
        }, {} as Record<string, (LabelItem & { applied_by_user_id: string })[]>);
      }

      const formattedConversations: Conversation[] = convData.map((conv: any) => ({
        id: conv.id,
        contact_phone_number: conv.contact_phone_number,
        last_message_body: conv.last_message_body,
        last_message_time: conv.last_message_time,
        whatsapp_account_id: conv.whatsapp_account_id,
        whatsapp_account_name: conv.whatsapp_account_name,
        unread_count: conv.unread_count,
        labels: labelsByConversationId[conv.id] || [],
      }));
      
      setConversations(formattedConversations);

      const total = formattedConversations.reduce((sum, conv) => sum + conv.unread_count, 0);
      setTotalUnreadCount(total);

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
        .select("id, from_phone_number, to_phone_number, message_body, direction, created_at, message_type, media_url, media_caption, status, user_id")
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

  const markMessagesAsRead = useCallback(async (conversation: Conversation) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status: 'read' })
        .eq('whatsapp_account_id', conversation.whatsapp_account_id)
        .eq('from_phone_number', conversation.contact_phone_number)
        .eq('direction', 'incoming')
        .neq('status', 'read');

      if (error) {
        console.error('Error marking messages as read in DB:', error.message);
      } else {
        console.log('Messages marked as read in DB for conversation:', conversation.contact_phone_number);
      }
    } catch (error: any) {
      console.error('Error marking messages as read:', error.message);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWhatsappAccounts();
      fetchAllLabels();
      fetchDynamicQuickReplies();
    } else {
      setIsLoadingConversations(false);
    }
  }, [user, fetchWhatsappAccounts, fetchAllLabels, fetchDynamicQuickReplies]);

  useEffect(() => {
    if (user && whatsappAccounts.length > 0) {
      fetchConversations();
    } else if (user && whatsappAccounts.length === 0) {
      setIsLoadingConversations(false);
    }
  }, [whatsappAccounts, user, fetchConversations]);

  // Auto-reload conversations every 10 seconds
  useEffect(() => {
    if (user && whatsappAccounts.length > 0) {
      const intervalId = setInterval(() => {
        console.log('Auto-reloading conversations...');
        fetchConversations();
      }, 10000); // 10 seconds

      return () => clearInterval(intervalId); // Cleanup on unmount
    }
  }, [user, whatsappAccounts, fetchConversations]);


  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
      fetchConversations();
    } else {
      setMessages([]);
    }
  }, [selectedConversation, fetchMessages, markMessagesAsRead, fetchConversations]);

  // Realtime subscriptions for messages, conversations, labels, and quick replies
  useEffect(() => {
    if (!user) return;

    // Channel for new messages and status updates
    const messageChannel = supabase
      .channel(`messages_for_all_users`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT and UPDATE
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          console.log('Realtime: Message event received:', payload.eventType, updatedMessage);
          
          const targetContact = updatedMessage.direction === 'incoming' ? updatedMessage.from_phone_number : updatedMessage.to_phone_number;
          const targetWhatsappAccountId = updatedMessage.whatsapp_account_id;

          const isMessageForSelectedConversation = selectedConversation &&
            targetWhatsappAccountId === selectedConversation.whatsapp_account_id &&
            targetContact === selectedConversation.contact_phone_number;

          if (isMessageForSelectedConversation) {
            setMessages((prevMessages) => {
              if (payload.eventType === 'INSERT') {
                if (updatedMessage.direction === 'outgoing' && updatedMessage.user_id === user.id) {
                  // For outgoing messages, try to find and replace the optimistic message
                  const existingIndex = prevMessages.findIndex(msg =>
                    msg.status === 'sending' &&
                    msg.message_body === updatedMessage.message_body &&
                    msg.to_phone_number === updatedMessage.to_phone_number &&
                    msg.whatsapp_account_id === updatedMessage.whatsapp_account_id
                  );
                  if (existingIndex > -1) {
                    console.log('Realtime Debug: Replacing optimistic message with server-confirmed:', updatedMessage.id);
                    const newMessages = [...prevMessages];
                    newMessages[existingIndex] = updatedMessage;
                    return newMessages;
                  }
                }
                // If not an optimistic outgoing message, or no match found, just add it
                console.log('Realtime Debug: Adding new message (incoming or unmatched outgoing):', updatedMessage.id);
                return [...prevMessages, updatedMessage];
              } else if (payload.eventType === 'UPDATE') {
                // Update existing message (e.g., status change)
                const existingIndex = prevMessages.findIndex(msg => msg.id === updatedMessage.id);
                if (existingIndex > -1) {
                  console.log('Realtime Debug: Updating existing message status:', updatedMessage.id);
                  const newMessages = [...prevMessages];
                  newMessages[existingIndex] = updatedMessage;
                  return newMessages;
                }
              }
              return prevMessages;
            });
            if (updatedMessage.direction === 'incoming' && updatedMessage.status !== 'read') {
              markMessagesAsRead(selectedConversation);
            }
          }
          // Always re-fetch conversations to update unread counts and last message for all conversations
          fetchConversations(); 
        }
      )
      .subscribe();

    // Channel for conversation updates (e.g., last_message_at, last_message_body, unread_count)
    const conversationUpdateChannel = supabase
      .channel(`conversations_updates_for_all_users`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        (payload) => {
          console.log('Realtime: Conversation updated:', payload.new);
          fetchConversations(); // Re-fetch all conversations to update the list
        }
      )
      .subscribe();

    const labelChannel = supabase
      .channel(`conversation_labels_for_all_users`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversation_labels',
        },
        (payload) => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_labels',
        },
        (payload) => {
          fetchConversations();
          fetchAllLabels();
        }
      )
      .subscribe();

    const quickReplyChannel = supabase
      .channel(`quick_replies_for_all_users`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_quick_replies',
        },
        (payload) => {
          fetchDynamicQuickReplies();
        }
      )
      .subscribe();


    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(conversationUpdateChannel);
      supabase.removeChannel(labelChannel);
      supabase.removeChannel(quickReplyChannel);
    };
  }, [user, selectedConversation, markMessagesAsRead, whatsappAccounts, fetchConversations, fetchAllLabels, fetchDynamicQuickReplies]);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages]);

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSelectedConversationIds([]);
  };

  const handleNewChatCreated = (conversation: {
    id: string;
    contact_phone_number: string;
    last_message_body: string;
    last_message_time: string;
    whatsapp_account_id: string;
    whatsapp_account_name: string;
  }) => {
    fetchConversations(); 
    setSelectedConversation({ ...conversation, unread_count: 0, labels: [] });
  };

  const uploadMediaToSupabase = useCallback(async (file: Blob, fileName: string, fileType: string) => {
    if (!user) {
      showError("You must be logged in to upload media.");
      return null;
    }

    const filePath = `${user.id}/${Date.now()}-${fileName}`;
    try {
      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileType,
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading media:", error.message);
      showError(`Failed to upload media: ${error.message}`);
      return null;
    }
  }, [user]);

  const handleSendMessage = useCallback(async (
    messageBody: string | null = null,
    mediaUrl: string | null = null,
    mediaType: string | null = null,
    mediaCaption: string | null = null
  ) => {
    if (!user || !selectedConversation) return;

    if (!messageBody && !mediaUrl) {
      showError("Message cannot be empty.");
      return;
    }

    const whatsappAccount = whatsappAccounts.find(acc => acc.id === selectedConversation.whatsapp_account_id);
    if (!whatsappAccount) {
      showError("WhatsApp account not found for sending message.");
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const optimisticMessage: Message = {
      id: tempId,
      from_phone_number: whatsappAccount.phone_number_id,
      to_phone_number: selectedConversation.contact_phone_number,
      message_body: messageBody || `[${mediaType} message]${mediaCaption ? `: ${mediaCaption}` : ''}`,
      direction: 'outgoing',
      created_at: now,
      message_type: mediaType || 'text',
      media_url: mediaUrl,
      media_caption: mediaCaption,
      status: 'sending',
      user_id: user.id, // Include user_id for optimistic message
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();
    setNewMessage("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          toPhoneNumber: selectedConversation.contact_phone_number,
          messageBody: messageBody,
          whatsappAccountId: selectedConversation.whatsapp_account_id,
          userId: user.id,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          mediaCaption: mediaCaption,
        },
      });

      if (invokeError) {
        console.error("Supabase Function Invoke Error:", invokeError.message);
        showError(`Failed to send message: ${invokeError.message}`);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
        );
        return;
      }

      if (data.status === 'error') {
        console.error("Edge Function returned error status:", data.message, data.details);
        showError(`Failed to send message: ${data.message} ${data.details ? `(${JSON.stringify(data.details)})` : ''}`);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
        );
        return;
      }
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
      setAudioCaption("");
    } catch (error: any) {
      console.error("Error sending message:", error.message);
      showError(`Failed to send message: ${error.message}`);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
      );
    }
  }, [user, selectedConversation, whatsappAccounts, uploadMediaToSupabase]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!user) {
      showError("You must be logged in to delete messages.");
      return;
    }
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id); // Ensure only the sender can delete their message

      if (error) {
        throw error;
      }
      showSuccess("Message deleted successfully!");
      setMessages((prev) => prev.filter(msg => msg.id !== messageId));
      // Optionally, re-fetch conversations to update last message if the deleted one was the last
      fetchConversations();
    } catch (error: any) {
      console.error("Error deleting message:", error.message);
      showError(`Failed to delete message: ${error.message}`);
    }
  }, [user, fetchConversations]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        setAudioChunks((prev) => [...prev, e.data]);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        setAudioChunks([]);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setMediaRecorder(recorder);
      setAudioChunks([]);
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
      setAudioCaption("");
      showSuccess("Recording started...");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showError("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      showSuccess("Recording stopped. Ready to send.");
    }
  };

  const sendRecordedAudio = async () => {
    if (recordedAudioBlob && user) {
      const fileName = `audio-${Date.now()}.ogg`;
      const mediaUrl = await uploadMediaToSupabase(recordedAudioBlob, fileName, 'audio/ogg');
      if (mediaUrl) {
        await handleSendMessage(null, mediaUrl, 'audio', audioCaption);
      }
    } else {
      showError("No audio recorded to send.");
    }
  };

  const renderMediaMessage = (message: Message) => {
    if (!message.media_url) return null;

    const commonClasses = "mt-2 rounded-lg overflow-hidden";
    const captionClasses = "text-xs text-gray-600 dark:text-gray-300 mt-1";

    switch (message.message_type) {
      case 'image':
        return (
          <div className={commonClasses}>
            <img src={message.media_url} alt={message.media_caption || "Image"} className="max-w-xs max-h-60 object-contain" />
            {message.media_caption && <p className={captionClasses}>{message.media_caption}</p>}
          </div>
        );
      case 'audio':
        return (
          <div className={commonClasses}>
            <audio controls src={message.media_url} className="w-full"></audio>
            {message.media_caption && <p className={captionClasses}>{message.media_caption}</p>}
          </div>
        );
      case 'video':
        return (
          <div className={commonClasses}>
            <video controls src={message.media_url} className="max-w-xs max-h-60 object-contain"></video>
            {message.media_caption && <p className={captionClasses}>{message.media_caption}</p>}
          </div>
        );
      case 'document':
        return (
          <div className={commonClasses}>
            <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 hover:underline">
              <Download className="h-4 w-4 mr-2" />
              {message.media_caption || `Document (${message.media_url.split('/').pop()})`}
            </a>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTickMarks = (status: Message['status']) => {
    if (status === 'read') {
      return <CheckCheck className="h-4 w-4 text-blue-200 ml-1" />; 
    } else if (status === 'delivered') {
      return <CheckCheck className="h-4 w-4 text-gray-300 ml-1" />; 
    } else if (status === 'sent') {
      return <Check className="h-4 w-4 text-gray-300 ml-1" />; 
    } else if (status === 'sending') {
      return <span className="ml-1 text-xs text-gray-400">...</span>;
    } else if (status === 'failed') {
      return <X className="h-4 w-4 text-red-500 ml-1" />;
    }
    return null;
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesFilterType = filterType === 'all' || (filterType === 'unread' && conv.unread_count > 0);
    const matchesLabel = selectedLabelFilterId ? conv.labels.some(label => label.id === selectedLabelFilterId) : true;
    return matchesFilterType && matchesLabel;
  });

  const selectedLabelName = allLabels.find(label => label.id === selectedLabelFilterId)?.name || "Filter";

  const handleToggleConversationSelection = (conversationId: string) => {
    setSelectedConversationIds(prev =>
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handleClearSelection = () => {
    setSelectedConversationIds([]);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full overflow-hidden">
      <div className="flex-1 flex rounded-lg shadow-lg h-full overflow-hidden">
        {/* Conversations List */}
        <div className={cn(
          "w-full flex-shrink-0 flex-col bg-white dark:bg-gray-800 overflow-y-auto",
          "lg:w-96 lg:border-r lg:border-gray-200 dark:lg:border-gray-700",
          (isMobile && selectedConversation) ? "hidden" : "flex"
        )}>
          <div className="flex-shrink-0 p-4 sm:p-6 lg:p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex space-x-2">
                <ManageQuickRepliesDialog onQuickRepliesUpdated={fetchDynamicQuickReplies} />
                <AddNewContactDialog
                  whatsappAccounts={whatsappAccounts}
                  onNewChatCreated={handleNewChatCreated}
                />
              </div>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search chats..."
                className="pl-9 rounded-full bg-gray-100 dark:bg-gray-700 border-none"
              />
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'secondary'}
                className={cn("rounded-full px-4 py-2 text-sm", filterType === 'all' ? 'bg-brand-green text-white' : '')}
                onClick={() => { setFilterType('all'); setSelectedLabelFilterId(null); }}
                size="icon"
                title="All Conversations"
              >
                <ListFilter className="h-4 w-4" />
              </Button>
              <Button
                variant={filterType === 'unread' ? 'default' : 'secondary'}
                className={cn("rounded-full px-4 py-2 text-sm", filterType === 'unread' ? 'bg-brand-green text-white' : '')}
                onClick={() => { setFilterType('unread'); setSelectedLabelFilterId(null); }}
                size="icon"
                title="Unread Conversations"
              >
                <MailOpen className="h-4 w-4" />
                {totalUnreadCount > 0 && (
                  <span className="ml-2 bg-white text-brand-green rounded-full px-2">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedLabelFilterId ? 'default' : 'secondary'}
                    className={cn("rounded-full px-4 py-2 text-sm", selectedLabelFilterId ? 'bg-brand-green text-white' : '')}
                    size="icon"
                    title={selectedLabelFilterId ? `Filter: ${selectedLabelName}` : "Filter by Label"}
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm">Filter by Label</h4>
                    <p className="text-xs text-gray-500">Select labels to filter conversations.</p>
                  </div>
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => { setSelectedLabelFilterId(null); setFilterType('all'); }}
                    >
                      All Labels
                    </Button>
                    <Separator />
                    {allLabels.map((label) => (
                      <Button
                        key={label.id}
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={() => { setSelectedLabelFilterId(label.id); setFilterType('all'); }}
                      >
                        <LabelBadge name={label.name} color={label.color} />
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedConversationIds.length > 0 && (
                <>
                  <BulkApplyLabelsPopover
                    conversationIds={selectedConversationIds}
                    onLabelsApplied={() => {
                      fetchConversations();
                      handleClearSelection();
                    }}
                  />
                  <Button variant="outline" size="icon" onClick={handleClearSelection} title={`Clear Selection (${selectedConversationIds.length})`}>
                    <SquareX className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-gray-500">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {filterType === 'unread' ? 'No unread conversations.' : 'No conversations yet.'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={`${conv.whatsapp_account_id}-${conv.contact_phone_number}`}
                  className={cn(
                    `flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700`,
                    selectedConversation?.contact_phone_number === conv.contact_phone_number &&
                    selectedConversation?.whatsapp_account_id === conv.whatsapp_account_id
                      ? 'bg-blue-50 dark:bg-blue-900'
                      : '',
                    selectedConversationIds.includes(conv.id)
                      ? 'bg-yellow-100 dark:bg-yellow-900 border-l-4 border-brand-yellow'
                      : ''
                  )}
                >
                  <Checkbox
                    checked={selectedConversationIds.includes(conv.id)}
                    onCheckedChange={() => handleToggleConversationSelection(conv.id)}
                    className="mr-3 cursor-pointer"
                  />
                  <div className="flex-1 flex items-center cursor-pointer" onClick={() => handleConversationSelect(conv)}>
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage src={undefined} alt={conv.contact_phone_number} />
                      <AvatarFallback>{conv.contact_phone_number}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{conv.contact_phone_number}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{conv.last_message_body}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {conv.whatsapp_account_name}
                      </p>
                      {conv.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {conv.labels.map(label => (
                            <LabelBadge key={label.id} name={label.name} color={label.color} />
                          ))}
                        </div>
                      )}
                  </div>
                </div>
                <div className="flex flex-col items-end text-xs text-gray-400 dark:text-gray-500">
                  <span>{format(new Date(conv.last_message_time), 'MMM d, HH:mm')}</span>
                  {conv.unread_count > 0 && (
                    <span className="mt-1 bg-brand-green text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        {/* Message Area */}
        <div className={cn(
          "relative flex-col flex-1 bg-gray-50 dark:bg-gray-900 h-full",
          "bg-[radial-gradient(circle,var(--tw-gradient-stops))] from-gray-200/50 to-transparent bg-[size:20px_20px] dark:from-gray-700/50 dark:to-transparent",
          (isMobile && !selectedConversation) ? "hidden" : "flex"
        )}>
          {/* Header for Selected Conversation - Fixed at top */}
          <div className="absolute top-0 left-0 right-0 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 z-20 h-[72px]">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)} className="mr-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={undefined} alt={selectedConversation?.contact_phone_number} />
                  <AvatarFallback>{selectedConversation?.contact_phone_number}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-bold">{selectedConversation?.contact_phone_number}</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedConversation?.whatsapp_account_name}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              {selectedConversation && user && (
                <ApplyLabelsPopover
                  conversationId={selectedConversation.id}
                  currentLabels={selectedConversation.labels}
                  onLabelsApplied={fetchConversations}
                />
              )}
            </div>
          </div>

          {/* Messages - Scrollable area, takes remaining space */}
          <div className="flex-1 overflow-y-auto space-y-4 pt-[90px] pb-[80px] px-4 sm:px-6 lg:px-8">
            {isLoadingMessages ? (
              <div className="text-center text-gray-500">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500">No messages in this conversation.</div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex group", // Added group for hover effect
                    msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] p-2 rounded-xl flex flex-col relative", // Added relative for positioning delete button
                      msg.direction === 'outgoing'
                        ? 'bg-blue-500 dark:bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                    )}
                  >
                    {/* Message content */}
                    {msg.message_type === 'text' ? (
                      <p className="text-sm break-words">{msg.message_body}</p>
                    ) : (
                      <div>
                        {renderMediaMessage(msg)}
                        {msg.message_body && <p className="text-sm break-words">{msg.message_body}</p>}
                      </div>
                    )}
                    {/* Timestamp and ticks */}
                    <div className="flex items-center text-xs opacity-75 mt-1 ml-auto">
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                      {msg.direction === 'outgoing' && renderTickMarks(msg.status)}
                    </div>

                    {/* Delete button for outgoing messages */}
                    {msg.direction === 'outgoing' && msg.user_id === user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "absolute -top-2",
                              msg.direction === 'outgoing' ? '-left-8' : '-right-8', // Position to the left of outgoing, right of incoming
                              "h-6 w-6 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            )}
                            title="Delete Message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this message.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMessage(msg.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end bg-gray-50 dark:bg-gray-900 z-20 h-[80px]">
            <div className="relative flex-1 flex items-center bg-white dark:bg-gray-800 rounded-full px-4 py-2 mr-2 shadow-sm">
              <Input
                type="text"
                placeholder="Message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newMessage.trim()) {
                    handleSendMessage(newMessage);
                  }
                }}
                className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-auto p-0"
              />
              {selectedConversation && user && (
                <AttachmentOptionsDialog
                  onSendMessage={handleSendMessage}
                  onUploadMedia={uploadMediaToSupabase}
                  selectedConversationId={selectedConversation.id}
                  whatsappAccountId={selectedConversation.whatsapp_account_id}
                  userId={user.id}
                />
              )}

              {/* Quick Replies Popover */}
              <Popover open={isQuickRepliesPopoverOpen} onOpenChange={setIsQuickRepliesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
                    <Zap className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm">Quick Replies</h4>
                    <p className="text-xs text-gray-500">Select a predefined message.</p>
                  </div>
                  <div className="space-y-1">
                    {dynamicQuickReplies.length === 0 ? (
                      <p className="text-sm text-gray-500">No quick replies. Add some in "Manage Quick Replies".</p>
                    ) : (
                      dynamicQuickReplies.map((reply) => (
                        <Button
                          key={reply.id}
                          variant="ghost"
                          className="w-full justify-start text-sm h-auto py-1.5"
                          onClick={() => {
                            if (reply.type === 'text' && reply.text_content) {
                              setNewMessage(reply.text_content);
                            } else if (reply.type === 'audio' && reply.audio_url) {
                              handleSendMessage(null, reply.audio_url, 'audio', reply.name);
                            }
                            setIsQuickRepliesPopoverOpen(false);
                          }}
                        >
                          {reply.type === 'text' ? (
                            <MessageSquareText className="h-4 w-4 mr-2 text-blue-500" />
                          ) : (
                            <FileAudio className="h-4 w-4 mr-2 text-purple-500" />
                          )}
                          {reply.name}
                        </Button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {newMessage.trim() ? (
              <Button onClick={() => handleSendMessage(newMessage)} className="rounded-full h-10 w-10 p-0 flex-shrink-0 bg-brand-green hover:bg-brand-green/90">
                <Send className="h-5 w-5 text-white" />
              </Button>
            ) : isRecording ? (
              <Button variant="destructive" size="icon" onClick={stopRecording} className="rounded-full h-10 w-10 p-0 flex-shrink-0">
                <StopCircle className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={startRecording} className="rounded-full h-10 w-10 p-0 flex-shrink-0 bg-brand-green hover:bg-brand-green/90 text-white">
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Audio Recording Dialog (for direct mic recording) */}
      <Dialog open={!!recordedAudioUrl} onOpenChange={() => { setRecordedAudioUrl(null); setRecordedAudioBlob(null); setAudioCaption(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Recorded Audio Message</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {recordedAudioUrl && (
              <audio controls src={recordedAudioUrl} className="w-full"></audio>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="audioCaption" className="text-right">
                Caption (Optional)
              </Label>
              <Input
                id="audioCaption"
                value={audioCaption}
                onChange={(e) => setAudioCaption(e.target.value)}
                className="col-span-3"
                placeholder="Add a caption to your audio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRecordedAudioUrl(null); setRecordedAudioBlob(null); setAudioCaption(""); }}>Cancel</Button>
            <Button onClick={sendRecordedAudio} disabled={!recordedAudioBlob}>Send Audio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inbox;