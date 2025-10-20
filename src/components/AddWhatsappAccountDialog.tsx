"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showSuccess, showError } from "@/utils/toast";

interface AddWhatsappAccountDialogProps {
  onAccountAdded: () => void;
}

const AddWhatsappAccountDialog: React.FC<AddWhatsappAccountDialogProps> = ({ onAccountAdded }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to add a WhatsApp account.");
      return;
    }
    if (!accountName || !phoneNumberId || !accessToken) {
      showError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .insert({
          user_id: user.id,
          account_name: accountName,
          phone_number_id: phoneNumberId,
          access_token: accessToken,
        });

      if (error) {
        throw error;
      }

      showSuccess("WhatsApp account added successfully!");
      setAccountName("");
      setPhoneNumberId("");
      setAccessToken("");
      setIsOpen(false);
      onAccountAdded(); // Notify parent component that an account was added
    } catch (error: any) {
      console.error("Error adding WhatsApp account:", error.message);
      showError(`Failed to add account: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add WhatsApp Account</DialogTitle>
          <DialogDescription>
            Enter the details for your WhatsApp Business Account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accountName" className="text-right">
                Account Name
              </Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., My Business"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneNumberId" className="text-right">
                Phone Number ID
              </Label>
              <Input
                id="phoneNumberId"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="col-span-3"
                placeholder="From Meta Developer Dashboard"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accessToken" className="text-right">
                Access Token
              </Label>
              <Input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="col-span-3"
                placeholder="Bearer token from Meta"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddWhatsappAccountDialog;