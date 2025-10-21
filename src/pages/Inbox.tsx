"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send, Mic, Camera, Paperclip, StopCircle, PlayCircle, PauseCircle, Download, PlusCircle, Search } from 'lucide-react';
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
import AddNewContactDialog from '@/components/AddNewContactDialog'; // Import the new component
import { cn } from '@/lib/utils'; // Import cn for conditional classNames
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Import Avatar components

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
  message_type: string; // e.g., 'text', 'image', 'audio', 'document'
  media_url?: string | null;
  media_caption?: string | null;
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

  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [audioCaption, setAudioCaption] = useState("");

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");

  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCaption, setFileCaption] = useState("");

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

  const handleNewChatCreated = (conversation: Conversation) => {
    // This function is called from AddNewContactDialog when a new chat is created
    // or an existing one is found. We need to refresh conversations and select it.
    fetchConversations(); // Refresh the list to include the new/found conversation
    setSelectedConversation(conversation); // Directly select the conversation
  };

  const uploadMediaToSupabase = async (file: Blob, fileName: string, fileType: string) => {
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
  };

  const handleSendMessage = async (
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

    console.log("Attempting to invoke 'send-whatsapp-message' Edge Function...");
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
        // This error is from the invoke call itself (e.g., network error, function not found)
        console.error("Supabase Function Invoke Error:", invokeError.message);
        showError(`Failed to send message: ${invokeError.message}`);
        return;
      }

      // Check for application-level errors returned by the Edge Function
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
      setCapturedImageBlob(null);
      setCapturedImageUrl(null);
      setImageCaption("");
      setSelectedFile(null);
      setFileCaption("");
      setIsAttachmentDialogOpen(false);
      // Messages and conversations will be updated via realtime subscription
    } catch (error: any) {
      console.error("Error sending message:", error.message);
      showError(`Failed to send message: ${error.message}`);
    }
  };

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        setAudioChunks((prev) => [...prev, e.data]);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' }); // WhatsApp prefers OGG
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        setAudioChunks([]);
        stream.getTracks().forEach(track => track.stop()); // Stop microphone access
      };
      recorder.start();
      setIsRecording(true);
      setMediaRecorder(recorder);
      setAudioChunks([]); // Clear previous chunks
      setRecordedAudioBlob(null); // Clear previous recording
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

  // --- Camera Logic ---
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      showError("Failed to open camera. Please check camera permissions.");
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setCapturedImageBlob(null);
    setCapturedImageUrl(null);
    setImageCaption("");
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            setCapturedImageBlob(blob);
            setCapturedImageUrl(URL.createObjectURL(blob));
            showSuccess("Photo captured!");
          }
        }, 'image/jpeg');
      }
    }
  };

  const sendCapturedImage = async () => {
    if (capturedImageBlob && user) {
      const fileName = `image-${Date.now()}.jpeg`;
      const mediaUrl = await uploadMediaToSupabase(capturedImageBlob, fileName, 'image/jpeg');
      if (mediaUrl) {
        await handleSendMessage(null, mediaUrl, 'image', imageCaption);
        closeCamera();
      }
    } else {
      showError("No image captured to send.");
    }
  };

  // --- Attachment Logic ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const sendAttachment = async () => {
    if (selectedFile && user) {
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `document-${Date.now()}.${fileExtension}`;
      const mediaUrl = await uploadMediaToSupabase(selectedFile, fileName, selectedFile.type);
      if (mediaUrl) {
        // Determine mediaType based on file type for WhatsApp API
        let mediaType = 'document'; // Default
        if (selectedFile.type.startsWith('image/')) mediaType = 'image';
        if (selectedFile.type.startsWith('audio/')) mediaType = 'audio';
        if (selectedFile.type.startsWith('video/')) mediaType = 'video';

        await handleSendMessage(null, mediaUrl, mediaType, fileCaption);
      }
    } else {
      showError("No file selected to send.");
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Dynamic Header for Inbox/Chat */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center">
          {selectedConversation ? (
            <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          {selectedConversation ? (
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarImage src={undefined} alt={selectedConversation.contact_phone_number} />
                <AvatarFallback>{selectedConversation.contact_phone_number.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-bold">{selectedConversation.contact_phone_number}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedConversation.whatsapp_account_name}
                </p>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-bold ml-4">WhatsApp Inbox</h1>
          )}
        </div>
        {/* Removed MoreVertical button as per WhatsApp UI */}
      </div>

      {/* Main Content Area (Conversations List or Message Area) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        {!selectedConversation && (
          <div className="relative w-full bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search chats..."
                  className="pl-9 rounded-full bg-gray-100 dark:bg-gray-700 border-none"
                />
              </div>
              <div className="flex space-x-2 overflow-x-auto pb-2">
                <Button variant="secondary" className="rounded-full px-4 py-2 text-sm">All</Button>
                <Button variant="secondary" className="rounded-full px-4 py-2 text-sm">Unread <span className="ml-2 bg-brand-green text-white rounded-full px-2">99+</span></Button>
                <Button variant="secondary" className="rounded-full px-4 py-2 text-sm">Favourites</Button>
                <Button variant="secondary" className="rounded-full px-4 py-2 text-sm">Groups</Button>
              </div>
            </div>
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
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src={undefined} alt={conv.contact_phone_number} />
                    <AvatarFallback>{conv.contact_phone_number.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{conv.contact_phone_number}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.last_message_body}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {conv.whatsapp_account_name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end text-xs text-gray-400 dark:text-gray-500">
                    <span>{format(new Date(conv.last_message_time), 'MMM d, HH:mm')}</span>
                    {/* Placeholder for unread count */}
                    {Math.random() > 0.7 && <span className="mt-1 bg-brand-green text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">1</span>}
                  </div>
                </div>
              ))
            )}
            <div className="absolute bottom-4 right-4">
              <AddNewContactDialog
                whatsappAccounts={whatsappAccounts}
                onNewChatCreated={handleNewChatCreated}
              />
            </div>
          </div>
        )}

        {/* Message Area */}
        {selectedConversation && (
          <div className="flex flex-col flex-1 w-full bg-gray-50 dark:bg-gray-900">
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
                        "max-w-[80%] p-2 rounded-xl flex flex-col relative", // Added relative for timestamp positioning
                        msg.direction === 'outgoing'
                          ? 'bg-brand-green text-white rounded-br-none'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                      )}
                    >
                      {/* Sender name/phone number - removed for WhatsApp-like bubbles */}
                      {msg.message_type === 'text' ? (
                        <p className="text-sm pr-10">{msg.message_body}</p> // Added padding for timestamp
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
              <div ref={messagesEndRef} /> {/* Scroll target */}
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 flex flex-col space-y-2">
                    <Button variant="ghost" className="justify-start" onClick={openCamera}>
                      <Camera className="h-4 w-4 mr-2" /> Camera
                    </Button>
                    <Button variant="ghost" className="justify-start" onClick={() => setIsAttachmentDialogOpen(true)}>
                      <Paperclip className="h-4 w-4 mr-2" /> Document
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Mic/Send Button */}
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

      {/* Audio Recording Dialog */}
      <Dialog open={!!recordedAudioUrl} onOpenChange={() => { setRecordedAudioUrl(null); setRecordedAudioBlob(null); setAudioCaption(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Audio Message</DialogTitle>
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

      {/* Camera Dialog */}
      <Dialog open={isCameraOpen} onOpenChange={closeCamera}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {!capturedImageUrl ? (
              <video ref={videoRef} className="w-full h-auto rounded-md bg-black" autoPlay playsInline></video>
            ) : (
              <img src={capturedImageUrl} alt="Captured" className="w-full h-auto rounded-md object-contain" />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            <div className="grid grid-cols-4 items-center gap-4 w-full">
              <Label htmlFor="imageCaption" className="text-right">
                Caption (Optional)
              </Label>
              <Input
                id="imageCaption"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                className="col-span-3"
                placeholder="Add a caption to your image"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCamera}>Cancel</Button>
            {!capturedImageUrl ? (
              <Button onClick={takePhoto}>Take Photo</Button>
            ) : (
              <Button onClick={sendCapturedImage} disabled={!capturedImageBlob}>Send Photo</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Dialog */}
      <Dialog open={isAttachmentDialogOpen} onOpenChange={setIsAttachmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Attachment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fileInput" className="text-right">
                File
              </Label>
              <Input
                id="fileInput"
                type="file"
                onChange={handleFileChange}
                className="col-span-3"
              />
            </div>
            {selectedFile && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Selected:</Label>
                <span className="col-span-3 text-sm truncate">{selectedFile.name}</span>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fileCaption" className="text-right">
                Caption (Optional)
              </Label>
              <Input
                id="fileCaption"
                value={fileCaption}
                onChange={(e) => setFileCaption(e.target.value)}
                className="col-span-3"
                placeholder="Add a caption to your file"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAttachmentDialogOpen(false); setSelectedFile(null); setFileCaption(""); }}>Cancel</Button>
            <Button onClick={sendAttachment} disabled={!selectedFile}>Send File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inbox;