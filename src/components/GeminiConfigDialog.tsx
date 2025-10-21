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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showSuccess, showError } from "@/utils/toast";

interface WhatsappAccount {
  id: string;
  account_name: string;
  gemini_system_instruction: string | null;
}

interface GeminiConfigDialogProps {
  account: WhatsappAccount;
  onConfigUpdated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const GeminiConfigDialog: React.FC<GeminiConfigDialogProps> = ({
  account,
  onConfigUpdated,
  isOpen,
  onOpenChange,
}) => {
  const { user } = useSession();
  const [systemInstruction, setSystemInstruction] = useState(account.gemini_system_instruction || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSystemInstruction(account.gemini_system_instruction || "");
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to update AI configuration.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .update({
          gemini_system_instruction: systemInstruction.trim() || null, // Save as null if empty
        })
        .eq("id", account.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      showSuccess("Gemini AI configuration updated successfully!");
      onOpenChange(false);
      onConfigUpdated();
    } catch (error: any) {
      console.error("Error updating Gemini AI configuration:", error.message);
      showError(`Failed to update AI config: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Gemini AI for {account.account_name}</DialogTitle>
          <DialogDescription>
            Provide system instructions to guide the Gemini AI's responses for this WhatsApp account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="systemInstruction" className="text-right pt-2">
                System Instruction
              </Label>
              <Textarea
                id="systemInstruction"
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                className="col-span-3"
                placeholder="e.g., You are a helpful customer service assistant for a business selling plastic mobile covers. The price for COD is 220. All orders are delivered within 7 days."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GeminiConfigDialog;