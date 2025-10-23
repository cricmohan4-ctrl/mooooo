"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Camera, Image, FileAudio, MapPin } from 'lucide-react';
import { CameraDialog } from './CameraDialog';
import { AudioFileDialog } from './AudioFileDialog';
import { LocationDialog } from './LocationDialog';
import { showSuccess, showError } from '@/utils/toast';

interface AttachmentOptionsDialogProps {
  onSendMessage: (messageBody: string | null, mediaUrl: string | null, mediaType: string | null, mediaCaption: string | null) => Promise<void>;
  onUploadMedia: (file: Blob, fileName: string, fileType: string) => Promise<string | null>;
  selectedConversationId: string;
  whatsappAccountId: string;
  userId: string;
}

const AttachmentOptionsDialog: React.FC<AttachmentOptionsDialogProps> = ({
  onSendMessage,
  onUploadMedia,
  selectedConversationId,
  whatsappAccountId,
  userId,
}) => {
  const [isMainDialogOpen, setIsMainDialogOpen] = useState(false);
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isAudioFileDialogOpen, setIsAudioFileDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  const galleryFileInputRef = useRef<HTMLInputElement>(null); // Ref for the hidden file input

  const handleOptionClick = (option: 'camera' | 'gallery' | 'audio' | 'location') => {
    setIsMainDialogOpen(false); // Close main dialog
    switch (option) {
      case 'camera':
        setIsCameraDialogOpen(true);
        break;
      case 'gallery':
        galleryFileInputRef.current?.click(); // Directly trigger the hidden file input
        break;
      case 'audio':
        setIsAudioFileDialogOpen(true);
        break;
      case 'location':
        setIsLocationDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleGalleryFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const fileExtension = file.name.split('.').pop();
      const fileName = `gallery-${Date.now()}.${fileExtension}`;
      const mediaUrl = await onUploadMedia(file, fileName, file.type);

      if (mediaUrl) {
        let mediaType = 'document'; // Default
        if (file.type.startsWith('image/')) mediaType = 'image';
        if (file.type.startsWith('video/')) mediaType = 'video';

        await onSendMessage(null, mediaUrl, mediaType, null); // No caption for direct gallery upload for now
        showSuccess("Media sent successfully!");
      }
    } else {
      showError("No file selected from gallery.");
    }
    // Reset the input value to allow selecting the same file again if needed
    if (galleryFileInputRef.current) {
      galleryFileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Dialog open={isMainDialogOpen} onOpenChange={setIsMainDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
            <Image className="h-4 w-4" /> {/* Changed to Image icon for general attachments */}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Choose Attachment Type</DialogTitle>
            <DialogDescription>
              Select how you want to share content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button variant="outline" className="flex flex-col h-24" onClick={() => handleOptionClick('camera')}>
              <Camera className="h-6 w-6 mb-1" />
              Camera
            </Button>
            <Button variant="outline" className="flex flex-col h-24" onClick={() => handleOptionClick('gallery')}>
              <Image className="h-6 w-6 mb-1" />
              Gallery
            </Button>
            <Button variant="outline" className="flex flex-col h-24" onClick={() => handleOptionClick('audio')}>
              <FileAudio className="h-6 w-6 mb-1" />
              Audio
            </Button>
            <Button variant="outline" className="flex flex-col h-24" onClick={() => handleOptionClick('location')}>
              <MapPin className="h-6 w-6 mb-1" />
              Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for direct gallery access */}
      <input
        type="file"
        accept="image/*,video/*"
        ref={galleryFileInputRef}
        onChange={handleGalleryFileChange}
        style={{ display: 'none' }}
      />

      {/* Sub-dialogs for each attachment type */}
      <CameraDialog
        isOpen={isCameraDialogOpen}
        onOpenChange={setIsCameraDialogOpen}
        onSendMessage={onSendMessage}
        onUploadMedia={onUploadMedia}
        selectedConversationId={selectedConversationId}
        whatsappAccountId={whatsappAccountId}
        userId={userId}
      />
      <AudioFileDialog
        isOpen={isAudioFileDialogOpen}
        onOpenChange={setIsAudioFileDialogOpen}
        onSendMessage={onSendMessage}
        onUploadMedia={onUploadMedia}
        selectedConversationId={selectedConversationId}
        whatsappAccountId={whatsappAccountId}
        userId={userId}
      />
      <LocationDialog
        isOpen={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
        onSendMessage={onSendMessage}
        selectedConversationId={selectedConversationId}
        whatsappAccountId={whatsappAccountId}
        userId={userId}
      />
    </>
  );
};

export default AttachmentOptionsDialog;