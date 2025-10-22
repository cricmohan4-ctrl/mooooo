"use client";

import React, { useState } from 'react';
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
import { GalleryDialog } from './GalleryDialog';
import { AudioFileDialog } from './AudioFileDialog';
import { LocationDialog } from './LocationDialog';
import { showSuccess } from '@/utils/toast';

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
  const [isGalleryDialogOpen, setIsGalleryDialogOpen] = useState(false);
  const [isAudioFileDialogOpen, setIsAudioFileDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  const handleOptionClick = (option: 'camera' | 'gallery' | 'audio' | 'location') => {
    setIsMainDialogOpen(false); // Close main dialog
    switch (option) {
      case 'camera':
        setIsCameraDialogOpen(true);
        break;
      case 'gallery':
        setIsGalleryDialogOpen(true);
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
      <GalleryDialog
        isOpen={isGalleryDialogOpen}
        onOpenChange={setIsGalleryDialogOpen}
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