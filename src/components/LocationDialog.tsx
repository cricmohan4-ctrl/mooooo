"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

interface LocationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (messageBody: string | null, mediaUrl: string | null, mediaType: string | null, mediaCaption: string | null) => Promise<void>;
  selectedConversationId: string;
  whatsappAccountId: string;
  userId: string;
}

export const LocationDialog: React.FC<LocationDialogProps> = ({
  isOpen,
  onOpenChange,
  onSendMessage,
  selectedConversationId,
  whatsappAccountId,
  userId,
}) => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState(""); // Optional name for the location
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const getLocation = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setIsLoadingLocation(false);
          showSuccess("Location fetched successfully!");
        },
        (error) => {
          console.error("Error getting location:", error);
          showError("Failed to get location. Please enable location services.");
          setIsLoadingLocation(false);
          setLatitude(null);
          setLongitude(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      showError("Geolocation is not supported by your browser.");
      setIsLoadingLocation(false);
    }
  };

  const handleSendLocation = async () => {
    if (latitude !== null && longitude !== null) {
      const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      const messageBody = locationName.trim()
        ? `My location: ${locationName.trim()}\n${googleMapsLink}`
        : `My location: ${googleMapsLink}`;

      await onSendMessage(messageBody, null, 'text', null); // Send as a text message with the link
      onOpenChange(false); // Close dialog after sending
      // Reset state
      setLatitude(null);
      setLongitude(null);
      setLocationName("");
    } else {
      showError("No location to send. Please fetch your location first.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setLatitude(null);
    setLongitude(null);
    setLocationName("");
    setIsLoadingLocation(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Location</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <Label>Your Current Location</Label>
            <Button onClick={getLocation} disabled={isLoadingLocation}>
              {isLoadingLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Get Location
                </>
              )}
            </Button>
          </div>
          {latitude !== null && longitude !== null && (
            <div className="grid gap-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Latitude: {latitude.toFixed(6)}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Longitude: {longitude.toFixed(6)}
              </p>
              <div className="grid grid-cols-4 items-center gap-4 mt-2">
                <Label htmlFor="locationName" className="text-right">
                  Name (Optional)
                </Label>
                <Input
                  id="locationName"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., My Office, Home"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSendLocation} disabled={latitude === null || longitude === null}>
            Send Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};