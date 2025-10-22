"use client";

import React, { useState, useRef, useEffect } from 'react';
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

interface CameraDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (messageBody: string | null, mediaUrl: string | null, mediaType: string | null, mediaCaption: string | null) => Promise<void>;
  onUploadMedia: (file: Blob, fileName: string, fileType: string) => Promise<string | null>;
  selectedConversationId: string;
  whatsappAccountId: string;
  userId: string;
}

export const CameraDialog: React.FC<CameraDialogProps> = ({
  isOpen,
  onOpenChange,
  onSendMessage,
  onUploadMedia,
  selectedConversationId,
  whatsappAccountId,
  userId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      showError("Failed to open camera. Please check camera permissions.");
      onOpenChange(false); // Close dialog if camera access fails
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
    setCapturedImageBlob(null);
    setCapturedImageUrl(null);
    setImageCaption("");
  };

  useEffect(() => {
    if (isOpen) {
      openCamera();
    } else {
      closeCamera();
    }
    return () => closeCamera(); // Cleanup on unmount or dialog close
  }, [isOpen]);

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
            closeCamera(); // Stop camera stream after capturing photo
          }
        }, 'image/jpeg');
      }
    }
  };

  const sendCapturedImage = async () => {
    if (capturedImageBlob) {
      const fileName = `image-${Date.now()}.jpeg`;
      const mediaUrl = await onUploadMedia(capturedImageBlob, fileName, 'image/jpeg');
      if (mediaUrl) {
        await onSendMessage(null, mediaUrl, 'image', imageCaption);
        onOpenChange(false); // Close dialog after sending
      }
    } else {
      showError("No image captured to send.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Take Photo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {!capturedImageUrl && isCameraActive ? (
            <video ref={videoRef} className="w-full h-auto rounded-md bg-black" autoPlay playsInline></video>
          ) : capturedImageUrl ? (
            <img src={capturedImageUrl} alt="Captured" className="w-full h-auto rounded-md object-contain" />
          ) : (
            <div className="w-full h-60 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-500">
              Camera not active or no image captured.
            </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!capturedImageUrl && isCameraActive ? (
            <Button onClick={takePhoto}>Take Photo</Button>
          ) : (
            <Button onClick={sendCapturedImage} disabled={!capturedImageBlob}>Send Photo</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};