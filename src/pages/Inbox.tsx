"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send, Mic, Camera, Paperclip, StopCircle, PlayCircle, PauseCircle, Download } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile'; // Import the hook

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
  const isMobile = useIsMobile(); // Use the mobile detection hook

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

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
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

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
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
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
        {isMobile && selectedConversation ? (
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
        <h1 className="text-2xl font-bold ml-4">WhatsApp Inbox</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        {(!isMobile || (isMobile && !selectedConversation)) && (
          <div className={`w-full ${!isMobile ? 'md:w-1/3' : ''} border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto`}>
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
        )}

        {/* Message Area */}
        {(!isMobile || (isMobile && selectedConversation)) && (
          <div className={`flex flex-col flex-1 bg-gray-50 dark:bg-gray-900 ${isMobile && selectedConversation ? 'w-full' : ''}`}>
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
                          {msg.message_type === 'text' ? (
                            <p>{msg.message_body}</p>
                          ) : (
                            renderMediaMessage(msg)
                          )}
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="mr-2">
                        <Paperclip className="h-5 w-5" />
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

                  {isRecording ? (
                    <Button variant="destructive" size="icon" onClick={stopRecording} className="mr-2">
                      <StopCircle className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={startRecording} className="mr-2">
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}

                  <Input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage(newMessage);
                      }
                    }}
                    className="flex-1 mr-2"
                  />
                  <Button onClick={() => handleSendMessage(newMessage)} disabled={!newMessage.trim()}>
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