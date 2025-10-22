"use client";

import React, { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
}

interface AddNewContactDialogProps {
  whatsappAccounts: WhatsappAccount[];
  onNewChatCreated: (conversation: {
    id: string; // Added id to the expected conversation object
    contact_phone_number: string;
    last_message_body: string;
    last_message_time: string;
    whatsapp_account_id: string;
    whatsapp_account_name: string;
  }) => void;
}

const AddNewContactDialog: React.FC<AddNewContactDialogProps> = ({ whatsappAccounts, onNewChatCreated }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [newContactPhoneNumber, setNewContactPhoneNumber] = useState("");
  const [selectedWhatsappAccountId, setSelectedWhatsappAccountId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (whatsappAccounts.length > 0 && !selectedWhatsappAccountId) {
      setSelectedWhatsappAccountId(whatsappAccounts[0].id);
    }
  }, [whatsappAccounts, selectedWhatsappAccountId]);

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to create a new chat.");
      return;
    }
    if (!newContactPhoneNumber.trim() || !selectedWhatsappAccountId) {
      showError("Please enter a phone number and select a WhatsApp account.");
      return;
    }

    setIsLoading(true);
    try {
      // Check if conversation already exists
      const { data: existingConversation, error: fetchError } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        // Removed .eq("user_id", user.id) to allow all authenticated users to see all conversations
        .eq("whatsapp_account_id", selectedWhatsappAccountId)
        .eq("contact_phone_number", newContactPhoneNumber.trim())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchError;
      }

      let conversationToOpen;

      if (existingConversation) {
        showSuccess("Conversation already exists. Opening chat.");
        conversationToOpen = {
          id: existingConversation.id, // Pass the existing ID
          contact_phone_number: existingConversation.contact_phone_number,
          last_message_body: existingConversation.last_message_body || "",
          last_message_time: existingConversation.last_message_at || new Date().toISOString(),
          whatsapp_account_id: existingConversation.whatsapp_account_id,
          whatsapp_account_name: whatsappAccounts.find(acc => acc.id === existingConversation.whatsapp_account_id)?.account_name || "Unknown Account",
        };
      } else {
        // Insert new conversation
        const { data, error } = await supabase
          .from("whatsapp_conversations")
          .insert({
            user_id: user.id, // Keep user_id here to track who initiated the conversation
            whatsapp_account_id: selectedWhatsappAccountId,
            contact_phone_number: newContactPhoneNumber.trim(),
            last_message_at: new Date().toISOString(),
            last_message_body: "", // Initialize with empty message
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        showSuccess("New chat created successfully!");
        conversationToOpen = {
          id: data.id, // Pass the new ID
          contact_phone_number: data.contact_phone_number,
          last_message_body: data.last_message_body || "",
          last_message_time: data.last_message_at || new Date().toISOString(),
          whatsapp_account_id: data.whatsapp_account_id,
          whatsapp_account_name: whatsappAccounts.find(acc => acc.id === data.whatsapp_account_id)?.account_name || "Unknown Account",
        };
      }

      setNewContactPhoneNumber("");
      setIsOpen(false);
      onNewChatCreated(conversationToOpen); // Notify parent to open this chat
    } catch (error: any) {
      console.error("Error creating new chat:", error.message);
      showError(`Failed to create new chat: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="New Chat">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Start New Chat</DialogTitle>
          <DialogDescription>
            Enter the phone number of the contact you want to chat with.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateNewChat}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneNumber" className="text-right">
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                value={newContactPhoneNumber}
                onChange={(e) => setNewContactPhoneNumber(e.target.value)}
                className="col-span-3"
                placeholder="e.g., +1234567890"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="whatsappAccount" className="text-right">
                WhatsApp Account
              </Label>
              <Select
                onValueChange={setSelectedWhatsappAccountId}
                value={selectedWhatsappAccountId}
                required
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {whatsappAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Start Chat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddNewContactDialog;