"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';

interface AudioFileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (messageBody: string | null, mediaUrl: string | null, mediaType: string | null, mediaCaption: string | null) => Promise<void>;
  onUploadMedia: (file: Blob, fileName: string, fileType: string) => Promise<string | null>;
  selectedConversationId: string;
  whatsappAccountId: string;
  userId: string;
}

export const AudioFileDialog: React.FC<AudioFileDialogProps> = ({
  isOpen,
  onOpenChange,
  onSendMessage,
  onUploadMedia,
  selectedConversationId,
  whatsappAccountId,
  userId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileCaption, setFileCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('audio/')) {
        showError("Please select an audio file.");
        setSelectedFile(null);
        setFilePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  };

  const handleSendFile = async () => {
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `audio-${Date.now()}.${fileExtension}`;
      const mediaUrl = await onUploadMedia(selectedFile, fileName, selectedFile.type);

      if (mediaUrl) {
        await onSendMessage(null, mediaUrl, 'audio', fileCaption);
        onOpenChange(false); // Close dialog after sending
        // Reset state
        setSelectedFile(null);
        setFilePreviewUrl(null);
        setFileCaption("");
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      showError("No audio file selected to send.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setFileCaption("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Audio File</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="audioFileInput" className="text-right">
              Choose Audio
            </Label>
            <Input
              id="audioFileInput"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="col-span-3"
              ref={fileInputRef}
            />
          </div>
          {filePreviewUrl && selectedFile && (
            <div className="col-span-4 flex flex-col items-center">
              <audio controls src={filePreviewUrl} className="w-full"></audio>
              <p className="text-sm text-gray-500 mt-2">{selectedFile.name}</p>
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
              placeholder="Add a caption to your audio"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSendFile} disabled={!selectedFile}>Send Audio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};