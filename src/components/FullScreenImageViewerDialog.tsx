"use client";

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Share2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';

interface FullScreenImageViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  imageAlt?: string;
}

export const FullScreenImageViewerDialog: React.FC<FullScreenImageViewerDialogProps> = ({
  isOpen,
  onOpenChange,
  imageUrl,
  imageAlt = "Full screen image",
}) => {
  const handleDownload = async () => {
    if (!imageUrl) {
      showError("No image URL available for download.");
      return;
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = imageUrl.split('/').pop() || 'downloaded_image.png';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess(`Image "${fileName}" downloaded to your device's "Downloads" folder.`);
    } catch (error: any) {
      console.error("Error downloading image:", error.message);
      showError("Failed to download image.");
    }
  };

  const handleShare = async () => {
    if (!imageUrl) {
      showError("No image to share.");
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], imageUrl.split('/').pop() || 'shared_image.png', { type: blob.type });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: imageAlt,
          text: `Check out this image: ${imageAlt}`,
        });
        showSuccess("Image shared successfully!");
      } else {
        // Fallback for browsers/environments that don't support Web Share API
        showError("Web Share API is not supported in this browser. Please use the download button instead.");
        // Optionally, you could trigger a download here as a fallback, but the user already has a dedicated download button.
      }
    } catch (error: any) {
      console.error("Error sharing image:", error.message);
      // User might have cancelled the share, so only show error if it's not an abort error
      if (error.name !== 'AbortError') {
        showError(`Failed to share image: ${error.message}`);
      } else {
        console.log("Image sharing cancelled by user.");
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full flex items-center justify-center p-0 bg-transparent border-none shadow-none">
        <div className="relative w-full h-full flex items-center justify-center">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={imageAlt}
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:text-gray-200 bg-black/50 hover:bg-black/70 rounded-full z-50"
            onClick={() => onOpenChange(false)}
            title="Close"
          >
            <X className="h-6 w-6" />
          </Button>
          
          {imageUrl && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-16 text-white hover:text-gray-200 bg-black/50 hover:bg-black/70 rounded-full z-50"
                onClick={handleDownload}
                title="Download Image"
              >
                <Download className="h-6 w-6" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-28 text-white hover:text-gray-200 bg-black/50 hover:bg-black/70 rounded-full z-50"
                    title="More Options"
                  >
                    <MoreVertical className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    <span>Share</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};