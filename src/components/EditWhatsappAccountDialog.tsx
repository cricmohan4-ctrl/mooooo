"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showSuccess, showError } from "@/utils/toast";
import { Separator } from "@/components/ui/separator";

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
  access_token: string; // We'll fetch this to pre-fill, but not display
}

interface EditWhatsappAccountDialogProps {
  account: WhatsappAccount;
  onAccountUpdated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditWhatsappAccountDialog: React.FC<EditWhatsappAccountDialogProps> = ({
  account,
  onAccountUpdated,
  isOpen,
  onOpenChange,
}) => {
  const { user } = useSession();
  const [accountName, setAccountName] = useState(account.account_name);
  const [phoneNumberId, setPhoneNumberId] = useState(account.phone_number_id);
  const [accessToken, setAccessToken] = useState(""); // Not pre-filled for security
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setAccountName(account.account_name);
    setPhoneNumberId(account.phone_number_id);
    setAccessToken(""); 
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to update a WhatsApp account.");
      return;
    }
    if (!accountName || !phoneNumberId) {
      showError("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    try {
      // Update WhatsApp Account details
      const updateAccountPayload: { account_name: string; phone_number_id: string; access_token?: string } = {
        account_name: accountName,
        phone_number_id: phoneNumberId,
      };
      if (accessToken.trim()) {
        updateAccountPayload.access_token = accessToken.trim();
      }

      const { error: accountError } = await supabase
        .from("whatsapp_accounts")
        .update(updateAccountPayload)
        .eq("id", account.id)
        .eq("user_id", user.id);

      if (accountError) {
        throw accountError;
      }

      showSuccess("WhatsApp account updated successfully!");
      onOpenChange(false);
      onAccountUpdated();
    } catch (error: any) {
      console.error("Error updating WhatsApp account:", error.message);
      showError(`Failed to update: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Edit WhatsApp Account</DialogTitle>
          <DialogDescription>
            Update your WhatsApp Business Account details.
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
                placeholder="Re-enter if changing (Bearer token from Meta)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditWhatsappAccountDialog;