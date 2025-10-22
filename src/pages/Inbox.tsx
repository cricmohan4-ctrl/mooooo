"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send, Mic, Camera, Paperclip, StopCircle, PlayCircle, PauseCircle, Download, PlusCircle, Search, Tag, Zap, FileAudio, MessageSquareText, X, ListFilter, MailOpen, SquareX, Tags } from 'lucide-react'; // Added ListFilter, MailOpen, SquareX, Tags
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
import ManageLabelsDialog from '@/components/ManageLabelsDialog';
import ApplyLabelsPopover from '@/components/ApplyLabelsPopover';
import LabelBadge from '@/components/LabelBadge';
import ManageQuickRepliesDialog from '@/components/ManageQuickRepliesDialog';
import BulkApplyLabelsPopover from '@/components/BulkApplyLabelsPopover'; // Import new component
import AttachmentOptionsDialog from '@/components/AttachmentOptionsDialog'; // Import new component
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox

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
  labels: LabelItem[];
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
  is_read?: boolean;
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
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');
  const [allLabels, setAllLabels] = useState<LabelItem[]>([]);
  const [selectedLabelFilterId, setSelectedLabelFilterId] = useState<string | null>(null);
  const [isQuickRepliesPopoverOpen, setIsQuickRepliesPopoverOpen] = useState(false);
  const [dynamicQuickReplies, setDynamicQuickReplies] = useState<QuickReplyItem[]>([]);

  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]); // New state for multi-select

  // Media states for audio recording (kept here as it's direct input)
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

  const fetchAllLabels = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select('id, name, color')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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

      let labelsByConversationId: Record<string, LabelItem[]> = {};
      if (conversationIds.length > 0) {
        const { data: convLabelsData, error: convLabelsError } = await supabase
          .from('whatsapp_conversation_labels')
          .select('conversation_id, label_id, whatsapp_labels(id, name, color)')
          .in('conversation_id', conversationIds);

        if (convLabelsError) throw convLabelsError;

        labelsByConversationId = convLabelsData.reduce((acc, cl) => {
          const label = cl.whatsapp_labels as LabelItem;
          if (label) {
            if (!acc[cl.conversation_id]) {
              acc[cl.conversation_id] = [];
            }
            acc[cl.conversation_id].push(label);
          }
          return acc;
        }, {} as Record<string, LabelItem[]>);
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

  const markMessagesAsRead = useCallback(async (conversation: Conversation) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('whatsapp_account_id', conversation.whatsapp_account_id)
        .eq('from_phone_number', conversation.contact_phone_number)
        .eq('direction', 'incoming')
        .eq('is_read', false);

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

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
      fetchConversations();
    } else {
      setMessages([]);
    }
  }, [selectedConversation, fetchMessages, markMessagesAsRead, fetchConversations]);

  // Realtime subscription for messages and labels
  useEffect(() => {
    if (!user) return;

    const messageChannel = supabase
      .channel(`messages_for_user_${user.id}`)
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
          
          const targetContact = newMessage.direction === 'incoming' ? newMessage.from_phone_number : newMessage.to_phone_number;
          const targetWhatsappAccountId = newMessage.whatsapp_account_id;
          const isMessageForSelectedConversation = selectedConversation &&
            targetWhatsappAccountId === selectedConversation.whatsapp_account_id &&
            targetContact === selectedConversation.contact_phone_number;

          if (isMessageForSelectedConversation) {
            setMessages((prevMessages) => [...prevMessages, newMessage]);
            if (newMessage.direction === 'incoming' && !newMessage.is_read) {
              markMessagesAsRead(selectedConversation);
            }
          }
          fetchConversations(); // Re-fetch conversations to update unread counts and last message
        }
      )
      .subscribe();

    const labelChannel = supabase
      .channel(`conversation_labels_for_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'whatsapp_conversation_labels',
          filter: `conversation_id.in.(${conversations.map(c => c.id).join(',')})`, // Only for current conversations
        },
        (payload) => {
          // A label was added/removed from a conversation, or a label itself was updated
          // Re-fetch conversations to update labels displayed
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'whatsapp_labels',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // A label definition was changed (name/color), re-fetch conversations to update display
          fetchConversations();
          fetchAllLabels(); // Also re-fetch all labels for the filter popover
        }
      )
      .subscribe();

    const quickReplyChannel = supabase
      .channel(`quick_replies_for_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'whatsapp_quick_replies',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          fetchDynamicQuickReplies(); // Re-fetch quick replies when changes occur
        }
      )
      .subscribe();


    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(labelChannel);
      supabase.removeChannel(quickReplyChannel);
    };
  }, [user, selectedConversation, markMessagesAsRead, whatsappAccounts, fetchConversations, conversations, fetchAllLabels, fetchDynamicQuickReplies]);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has rendered before scrolling
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages]);

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSelectedConversationIds([]); // Clear multi-selection when opening a chat
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
        return;
      }

      if (data.status === 'error') {
        console.error("Edge Function returned error status:", data.message, data.details);
        showError(`Failed to send message: ${data.message} ${data.details ? `(${JSON.stringify(data.details)})` : ''}`);
        return;
      }

      showSuccess("Message sent successfully!");
      setNewMessage("");
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
      setAudioCaption("");
      // No need to reset camera/gallery/attachment states here, as they are managed by their own dialogs
    } catch (error: any) {
      console.error("Error sending message:", error.message);
      showError(`Failed to send message: ${error.message}`);
    }
  }, [user, selectedConversation, whatsappAccounts]);

  // --- Audio Recording Logic ---
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

  // --- Render Media Messages ---
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

  const filteredConversations = conversations.filter(conv => {
    const matchesFilterType = filterType === 'all' || (filterType === 'unread' && conv.unread_count > 0);
    const matchesLabel = selectedLabelFilterId ? conv.labels.some(label => label.id === selectedLabelFilterId) : true;
    return matchesFilterType && matchesLabel;
  });

  const selectedLabelName = allLabels.find(label => label.id === selectedLabelFilterId)?.name || "Filter"; // Keep for popover content

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
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Main Content Area (Conversations List or Message Area) */}
      {/* On mobile, only one of these will be visible at a time, controlled by `selectedConversation` state. */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        {!selectedConversation && (
          <div className="relative w-full bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="flex space-x-2">
                  <ManageLabelsDialog onLabelsUpdated={() => { fetchConversations(); fetchAllLabels(); }} />
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
                  size="icon" // Make it an icon button
                  title="All Conversations"
                >
                  <ListFilter className="h-4 w-4" />
                </Button>
                <Button
                  variant={filterType === 'unread' ? 'default' : 'secondary'}
                  className={cn("rounded-full px-4 py-2 text-sm", filterType === 'unread' ? 'bg-brand-green text-white' : '')}
                  onClick={() => { setFilterType('unread'); setSelectedLabelFilterId(null); }}
                  size="icon" // Make it an icon button
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
                      size="icon" // Make it an icon button
                      title={selectedLabelFilterId ? `Filter: ${selectedLabelName}` : "Filter by Label"}
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2">
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
                          <LabelBadge name={label.name} color={label.color} className="mr-2" />
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
                        fetchConversations(); // Refresh conversations to update labels
                        handleClearSelection(); // Clear selection after applying labels
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
        )}

        {/* Message Area */}
        {selectedConversation && (
          <div className="flex flex-col flex-1 w-full bg-gray-50 dark:bg-gray-900">
            {/* Sticky Header for Selected Conversation */}
            <div className="sticky top-0 z-10 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)} className="mr-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center">
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarImage src={undefined} alt={selectedConversation.contact_phone_number} />
                    <AvatarFallback>{selectedConversation.contact_phone_number}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-lg font-bold">{selectedConversation.contact_phone_number}</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedConversation.whatsapp_account_name}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <ApplyLabelsPopover
                  conversationId={selectedConversation.id}
                  currentLabels={selectedConversation.labels}
                  onLabelsApplied={fetchConversations}
                />
              </div>
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
                    className={cn(
                      "flex",
                      msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] p-2 rounded-xl flex flex-col relative",
                        msg.direction === 'outgoing'
                          ? 'bg-brand-green text-white rounded-br-none'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                      )}
                    >
                      {msg.message_type === 'text' ? (
                        <p className="text-sm pr-10">{msg.message_body}</p>
                      ) : (
                        <>
                          {renderMediaMessage(msg)}
                          {msg.message_body && <p className="text-sm pr-10">{msg.message_body}</p>}
                        </>
                      )}
                      <span className="absolute bottom-1 right-2 text-xs opacity-75">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 flex items-end bg-gray-50 dark:bg-gray-900 flex-shrink-0">
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
                              setIsQuickRepliesPopoverOpen(false); // Close popover after selection
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
        )}
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