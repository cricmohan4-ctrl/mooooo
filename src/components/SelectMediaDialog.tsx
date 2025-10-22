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

interface SelectMediaDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (messageBody: string | null, mediaUrl: string | null, mediaType: string | null, mediaCaption: string | null) => Promise<void>;
  onUploadMedia: (file: Blob, fileName: string, fileType: string) => Promise<string | null>;
  selectedConversationId: string;
  whatsappAccountId: string;
  userId: string;
}

export const SelectMediaDialog: React.FC<SelectMediaDialogProps> = ({
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
      const fileName = `gallery-${Date.now()}.${fileExtension}`;
      const mediaUrl = await onUploadMedia(selectedFile, fileName, selectedFile.type);

      if (mediaUrl) {
        let mediaType = 'document'; // Default
        if (selectedFile.type.startsWith('image/')) mediaType = 'image';
        if (selectedFile.type.startsWith('video/')) mediaType = 'video';

        await onSendMessage(null, mediaUrl, mediaType, fileCaption);
        onOpenChange(false); // Close dialog after sending
        // Reset state
        setSelectedFile(null);
        setFilePreviewUrl(null);
        setFileCaption("");
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      showError("No file selected to send.");
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
          <DialogTitle>Select Media from Gallery</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="galleryFileInput" className="text-right">
              Choose File
            </Label>
            <Input
              id="galleryFileInput"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="col-span-3"
              ref={fileInputRef}
            />
          </div>
          {filePreviewUrl && selectedFile && (
            <div className="col-span-4 flex flex-col items-center">
              {selectedFile.type.startsWith('image/') ? (
                <img src={filePreviewUrl} alt="Preview" className="max-w-full max-h-60 object-contain rounded-md" />
              ) : selectedFile.type.startsWith('video/') ? (
                <video controls src={filePreviewUrl} className="max-w-full max-h-60 object-contain rounded-md"></video>
              ) : null}
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
              placeholder="Add a caption to your media"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSendFile} disabled={!selectedFile}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};