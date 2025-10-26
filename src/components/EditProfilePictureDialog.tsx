"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { ImageUp, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface EditProfilePictureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentProfilePictureUrl: string | null | undefined;
  onProfilePictureUpdated: (newUrl: string | null) => void;
  userId: string;
  contactPhoneNumber: string;
}

export const EditProfilePictureDialog: React.FC<EditProfilePictureDialogProps> = ({
  isOpen,
  onOpenChange,
  conversationId,
  currentProfilePictureUrl,
  onProfilePictureUpdated,
  userId,
  contactPhoneNumber,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentProfilePictureUrl || null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear file input
      }
    }
  }, [isOpen, currentProfilePictureUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        showError("Please select an image file.");
        setSelectedFile(null);
        setPreviewUrl(currentProfilePictureUrl || null);
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl(currentProfilePictureUrl || null);
    }
  };

  const handleUploadAndSave = async () => {
    if (!selectedFile) {
      showError("Please select an image to upload.");
      return;
    }

    setIsLoading(true);
    try {
      const fileExtension = selectedFile.name.split('.').pop();
      const filePath = `${userId}/conversation_profile_pics/${conversationId}-${Date.now()}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true, // Upsert to replace if file with same name exists (though timestamp makes it unique)
          contentType: selectedFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      const newProfilePictureUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update({ profile_picture_url: newProfilePictureUrl })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      showSuccess("Profile picture updated successfully!");
      onProfilePictureUpdated(newProfilePictureUrl);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error uploading or saving profile picture:", error.message);
      showError(`Failed to update profile picture: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePicture = async () => {
    setIsLoading(true);
    try {
      // First, delete the old file from storage if it exists
      if (currentProfilePictureUrl) {
        const pathSegments = currentProfilePictureUrl.split('/public/whatsapp-media/');
        if (pathSegments.length > 1) {
          const filePathInStorage = pathSegments[1];
          const { error: deleteError } = await supabase.storage
            .from('whatsapp-media')
            .remove([filePathInStorage]);
          
          if (deleteError) {
            console.warn("Failed to delete old profile picture from storage:", deleteError.message);
            // Don't throw, proceed with updating DB to null
          }
        }
      }

      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update({ profile_picture_url: null })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      showSuccess("Profile picture removed successfully!");
      onProfilePictureUpdated(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error removing profile picture:", error.message);
      showError(`Failed to remove profile picture: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile Picture for {contactPhoneNumber}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center gap-4">
            {previewUrl ? (
              <img src={previewUrl} alt="Profile Preview" className="w-32 h-32 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-sm">
                No Image
              </div>
            )}
            <Label htmlFor="profilePicture" className="sr-only">
              Upload Profile Picture
            </Label>
            <Input
              id="profilePicture"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          {currentProfilePictureUrl && (
            <Button variant="destructive" onClick={handleRemovePicture} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </Button>
          )}
          <Button onClick={handleUploadAndSave} disabled={isLoading || !selectedFile}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};