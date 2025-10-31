"use client";

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};