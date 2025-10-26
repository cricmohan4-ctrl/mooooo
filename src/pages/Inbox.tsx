"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, User, Send, Mic, Camera, Paperclip, StopCircle, PlayCircle, PauseCircle, Download, PlusCircle, Search, Tag, Zap, FileAudio, MessageSquareText, X, ListFilter, MailOpen, SquareX, Tags, Check, CheckCheck, Trash2, Edit, Reply, Video, Eye } from 'lucide-react'; // Added Eye icon
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
import { EditProfilePictureDialog } from '@/components/EditProfilePictureDialog'; // Import new dialog

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
  profile_picture_url?: string | null;
  last_message_status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
  user_id?: string;
  // New fields for replies
  replied_to_message_id?: string | null;
  replied_to_message_body?: string | null;
  replied_to_message_type?: string | null;
  replied_to_media_url?: string | null;
  replied_to_media_caption?: string | null;
  replied_to_user_id?: string | null; // New
  replied_to_from_phone_number?: string | null; // New
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
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'admin' | null>(null);
  const [searchQuery, setSearchQuery] = useState(""); // New state for search query

  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [audioCaption, setAudioCaption] = useState("");

  const [isEditProfilePictureDialogOpen, setIsEditProfilePictureDialogOpen] = useState(false); // New state
  const [selectedConversationForProfilePic, setSelectedConversationForProfilePic] = useState<Conversation | null>(null); // New state

  const [replyingTo, setReplyingTo] = useState<Message | null>(null); // New state for replying to a message

  // New state for full-screen profile picture preview
  const [isFullScreenProfilePicDialogOpen, setIsFullScreenProfilePicDialogOpen] = useState(false);
  const [fullScreenProfilePicUrl, setFullScreenProfilePicUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchCurrentUserRole = useCallback(async () => {
    if (!user) {
      setCurrentUserRole(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCurrentUserRole(data?.role || 'user');
    } catch (error: any) {
      console.error("Error fetching current user role for Inbox:", error.message);
      setCurrentUserRole('user'); // Default to user role on error
    }
  }, [user]);

  const fetchWhatsappAccounts = useCallback(async () => {
    if (!user) {
      console.log('fetchWhatsappAccounts: No user, skipping account fetch.');
      return;
    }
    console.log('fetchWhatsappAccounts: Starting to fetch WhatsApp accounts...');
    try {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, account_name, phone_number_id");

      if (error) {
        throw error;
      }
      setWhatsappAccounts(data || []);
      console.log('fetchWhatsappAccounts: WhatsApp accounts fetched successfully:', data);
    } catch (error: any) {
      console.error("fetchWhatsappAccounts: Error fetching WhatsApp accounts:", error.message);
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
    }<ctrl63>