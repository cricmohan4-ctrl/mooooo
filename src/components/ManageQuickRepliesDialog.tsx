"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, XCircle, FileAudio, MessageSquareText, UploadCloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
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

interface QuickReplyItem {
  id: string;
  name: string;
  type: 'text' | 'audio';
  text_content: string | null;
  audio_url: string | null;
}

interface ManageQuickRepliesDialogProps {
  onQuickRepliesUpdated: () => void;
}

const ManageQuickRepliesDialog: React.FC<ManageQuickRepliesDialogProps> = ({ onQuickRepliesUpdated }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [newReplyName, setNewReplyName] = useState("");
  const [newReplyType, setNewReplyType] = useState<'text' | 'audio'>('text');
  const [newReplyTextContent, setNewReplyTextContent] = useState("");
  const [newReplyAudioFile, setNewReplyAudioFile] = useState<File | null>(null);
  const [newReplyAudioPreview, setNewReplyAudioPreview] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<QuickReplyItem | null>(null);
  const [editingReplyAudioFile, setEditingReplyAudioFile] = useState<File | null>(null);
  const [editingReplyAudioPreview, setEditingReplyAudioPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const fetchQuickReplies = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies')
        .select('id, name, type, text_content, audio_url')
        // Removed .eq('user_id', user.id) to allow all authenticated users to see all quick replies
        .order('name', { ascending: true });

      if (error) throw error;
      setQuickReplies(data || []);
    } catch (error: any) {
      console.error("Error fetching quick replies:", error.message);
      showError("Failed to load quick replies.");
    }
  };

  useEffect(() => {
    if (user && isOpen) {
      fetchQuickReplies();
    }
  }, [user, isOpen]);

  const handleNewAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Allow any audio type for upload, but warn about compatibility
      if (!file.type.startsWith('audio/')) {
        showError("Please upload an audio file.");
        setNewReplyAudioFile(null);
        setNewReplyAudioPreview(null);
        return;
      }
      setNewReplyAudioFile(file);
      setNewReplyAudioPreview(URL.createObjectURL(file));
    } else {
      setNewReplyAudioFile(null);
      setNewReplyAudioPreview(null);
    }
  };

  const handleEditAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Allow any audio type for upload, but warn about compatibility
      if (!file.type.startsWith('audio/')) {
        showError("Please upload an audio file.");
        setEditingReplyAudioFile(null);
        setEditingReplyAudioPreview(null);
        return;
      }
      setEditingReplyAudioFile(file);
      setEditingReplyAudioPreview(URL.createObjectURL(file));
    } else {
      setEditingReplyAudioFile(null);
      setEditingReplyAudioPreview(null);
    }
  };

  const uploadAudioToSupabase = async (file: File) => {
    if (!user) {
      showError("You must be logged in to upload audio.");
      return null;
    }
    // Normalize MIME type for M4A files to audio/mp4 for better WhatsApp compatibility
    let normalizedFileType = file.type;
    if (file.type === 'audio/x-m4a' || file.type === 'audio/aac') {
      normalizedFileType = 'audio/mp4';
    }

    const filePath = `${user.id}/quick-replies/audio-${Date.now()}-${file.name}`;
    try {
      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: normalizedFileType, // Use normalized type for upload
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading audio:", error.message);
      showError(`Failed to upload audio: ${error.message}`);
      return null;
    }
  };

  const handleAddQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to add a quick reply.");
      return;
    }
    if (!newReplyName.trim()) {
      showError("Reply name cannot be empty.");
      return;
    }
    if (newReplyType === 'text' && !newReplyTextContent.trim()) {
      showError("Text content cannot be empty for a text reply.");
      return;
    }
    if (newReplyType === 'audio' && !newReplyAudioFile) {
      showError("Please upload an audio file for an audio reply.");
      return;
    }

    setIsLoading(true);
    let audioUrl: string | null = null;
    if (newReplyType === 'audio' && newReplyAudioFile) {
      audioUrl = await uploadAudioToSupabase(newReplyAudioFile);
      if (!audioUrl) {
        setIsLoading(false);
        return; // Error already shown by uploadAudioToSupabase
      }
    }

    try {
      const { error } = await supabase
        .from('whatsapp_quick_replies')
        .insert({
          user_id: user.id, // RLS will handle user_id based on admin role
          name: newReplyName.trim(),
          type: newReplyType,
          text_content: newReplyType === 'text' ? newReplyTextContent.trim() : null,
          audio_url: newReplyType === 'audio' ? audioUrl : null,
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          showError("A quick reply with this name already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Quick reply added successfully!");
        setNewReplyName("");
        setNewReplyType('text');
        setNewReplyTextContent("");
        setNewReplyAudioFile(null);
        setNewReplyAudioPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchQuickReplies();
        onQuickRepliesUpdated();
      }
    } catch (error: any) {
      console.error("Error adding quick reply:", error.message);
      showError(`Failed to add quick reply: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingReply) return;
    if (!editingReply.name.trim()) {
      showError("Reply name cannot be empty.");
      return;
    }
    if (editingReply.type === 'text' && !editingReply.text_content?.trim()) {
      showError("Text content cannot be empty for a text reply.");
      return;
    }
    if (editingReply.type === 'audio' && !editingReply.audio_url && !editingReplyAudioFile) {
      showError("Please upload an audio file or ensure an existing one is linked for an audio reply.");
      return;
    }

    setIsLoading(true);
    let audioUrlToUpdate = editingReply.audio_url;
    if (editingReply.type === 'audio' && editingReplyAudioFile) {
      audioUrlToUpdate = await uploadAudioToSupabase(editingReplyAudioFile);
      if (!audioUrlToUpdate) {
        setIsLoading(false);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('whatsapp_quick_replies')
        .update({
          name: editingReply.name.trim(),
          type: editingReply.type,
          text_content: editingReply.type === 'text' ? editingReply.text_content?.trim() || null : null,
          audio_url: editingReply.type === 'audio' ? audioUrlToUpdate : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingReply.id);
        // RLS will enforce that only admins can update

      if (error) {
        if (error.code === '23505') { // Unique violation
          showError("A quick reply with this name already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Quick reply updated successfully!");
        setEditingReply(null);
        setEditingReplyAudioFile(null);
        setEditingReplyAudioPreview(null);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
        fetchQuickReplies();
        onQuickRepliesUpdated();
      }
    } catch (error: any) {
      console.error("Error updating quick reply:", error.message);
      showError(`Failed to update quick reply: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuickReply = async (replyId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('whatsapp_quick_replies')
        .delete()
        .eq('id', replyId);
        // RLS will enforce that only admins can delete

      if (error) throw error;
      showSuccess("Quick reply deleted successfully!");
      fetchQuickReplies();
      onQuickRepliesUpdated();
    } catch (error: any) {
      console.error("Error deleting quick reply:", error.message);
      showError(`Failed to delete quick reply: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Manage Quick Replies">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Quick Replies</DialogTitle>
          <DialogDescription>
            Create, edit, or delete predefined text or audio messages for quick sending.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <h3 className="text-lg font-semibold">Existing Quick Replies</h3>
          {quickReplies.length === 0 ? (
            <p className="text-sm text-gray-500">No quick replies created yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {quickReplies.map((reply) => (
                <div key={reply.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                  {editingReply?.id === reply.id ? (
                    <form onSubmit={handleUpdateQuickReply} className="flex-1 grid grid-cols-1 gap-2">
                      <Input
                        value={editingReply.name}
                        onChange={(e) => setEditingReply({ ...editingReply, name: e.target.value })}
                        placeholder="Reply Name"
                        required
                      />
                      <Select
                        value={editingReply.type}
                        onValueChange={(value: 'text' | 'audio') => {
                          setEditingReply({ ...editingReply, type: value, text_content: null, audio_url: null });
                          setEditingReplyAudioFile(null);
                          setEditingReplyAudioPreview(null);
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Message</SelectItem>
                          <SelectItem value="audio">Audio Message</SelectItem>
                        </SelectContent>
                      </Select>
                      {editingReply.type === 'text' && (
                        <Textarea
                          value={editingReply.text_content || ""}
                          onChange={(e) => setEditingReply({ ...editingReply, text_content: e.target.value })}
                          placeholder="Text content"
                          rows={2}
                          required
                        />
                      )}
                      {editingReply.type === 'audio' && (
                        <>
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={handleEditAudioFileChange}
                            ref={editFileInputRef}
                          />
                          {(editingReplyAudioPreview || editingReply.audio_url) && (
                            <audio controls src={editingReplyAudioPreview || editingReply.audio_url || ""} className="w-full mt-2"></audio>
                          )}
                        </>
                      )}
                      <div className="flex justify-end gap-2 mt-2">
                        <Button type="submit" size="sm" disabled={isLoading}>Save</Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => {
                          setEditingReply(null);
                          setEditingReplyAudioFile(null);
                          setEditingReplyAudioPreview(null);
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}>
                          <XCircle className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {reply.type === 'text' ? <MessageSquareText className="h-4 w-4 text-blue-500" /> : <FileAudio className="h-4 w-4 text-purple-500" />}
                        <span className="font-medium">{reply.name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({reply.type === 'text' ? 'Text' : 'Audio'})
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingReply(reply);
                          setEditingReplyAudioPreview(reply.audio_url);
                          setEditingReplyAudioFile(null); // Clear file input
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }} title="Edit Quick Reply">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete Quick Reply">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the quick reply "{reply.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteQuickReply(reply.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          <h3 className="text-lg font-semibold">Add New Quick Reply</h3>
          <form onSubmit={handleAddQuickReply} className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newReplyName" className="text-right">
                Name
              </Label>
              <Input
                id="newReplyName"
                value={newReplyName}
                onChange={(e) => setNewReplyName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Welcome Message, Pricing Audio"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newReplyType" className="text-right">
                Type
              </Label>
              <Select
                value={newReplyType}
                onValueChange={(value: 'text' | 'audio') => {
                  setNewReplyType(value);
                  setNewReplyTextContent("");
                  setNewReplyAudioFile(null);
                  setNewReplyAudioPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select reply type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Message</SelectItem>
                  <SelectItem value="audio">Audio Message</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newReplyType === 'text' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newReplyTextContent" className="text-right">
                  Text Content
                </Label>
                <Textarea
                  id="newReplyTextContent"
                  value={newReplyTextContent}
                  onChange={(e) => setNewReplyTextContent(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter your quick text message here."
                  rows={3}
                  required
                />
              </div>
            )}

            {newReplyType === 'audio' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newReplyAudioFile" className="text-right">
                  Audio File
                </Label>
                <div className="col-span-3">
                  <Input
                    id="newReplyAudioFile"
                    type="file"
                    accept="audio/*"
                    onChange={handleNewAudioFileChange}
                    ref={fileInputRef}
                    required
                  />
                  {newReplyAudioPreview && (
                    <audio controls src={newReplyAudioPreview} className="w-full mt-2"></audio>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Note: For best compatibility with WhatsApp, please upload audio files in **OGG (Opus codec)** or **MP4 (AAC codec)** format. If your audio fails to send, try converting it with a tool like Audacity or an online converter.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Quick Reply"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageQuickRepliesDialog;