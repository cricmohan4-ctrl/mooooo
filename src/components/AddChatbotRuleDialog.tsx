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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddChatbotRuleDialogProps {
  onRuleAdded: () => void;
  whatsappAccounts: { id: string; account_name: string }[];
}

const AddChatbotRuleDialog: React.FC<AddChatbotRuleDialogProps> = ({ onRuleAdded, whatsappAccounts }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWhatsappAccountId, setSelectedWhatsappAccountId] = useState<string>("");
  const [triggerValue, setTriggerValue] = useState("");
  const [triggerType, setTriggerType] = useState<"EXACT_MATCH" | "CONTAINS" | "STARTS_WITH">("EXACT_MATCH");
  const [responseMessage, setResponseMessage] = useState(""); // This will be a multi-line string
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (whatsappAccounts.length > 0 && !selectedWhatsappAccountId) {
      setSelectedWhatsappAccountId(whatsappAccounts[0].id);
    }
  }, [whatsappAccounts, selectedWhatsappAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to add a chatbot rule.");
      return;
    }
    if (!selectedWhatsappAccountId || !triggerValue || !responseMessage.trim()) {
      showError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      // Split the multi-line response into an array of messages
      const responseMessagesArray = responseMessage.split('\n').map(msg => msg.trim()).filter(msg => msg.length > 0);

      const { error } = await supabase
        .from("chatbot_rules")
        .insert({
          user_id: user.id,
          whatsapp_account_id: selectedWhatsappAccountId,
          trigger_value: triggerValue,
          trigger_type: triggerType,
          response_message: responseMessagesArray, // Store as an array
        });

      if (error) {
        throw error;
      }

      showSuccess("Chatbot rule added successfully!");
      setTriggerValue("");
      setResponseMessage("");
      setTriggerType("EXACT_MATCH");
      setIsOpen(false);
      onRuleAdded(); // Notify parent component that a rule was added
    } catch (error: any) {
      console.error("Error adding chatbot rule:", error.message);
      showError(`Failed to add rule: ${error.message}`);
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
          <DialogTitle>Add Chatbot Rule</DialogTitle>
          <DialogDescription>
            Define a trigger phrase and the automated response for a WhatsApp account. Each line in the response will be a separate message.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="triggerType" className="text-right">
                Trigger Type
              </Label>
              <Select
                onValueChange={(value: "EXACT_MATCH" | "CONTAINS" | "STARTS_WITH") => setTriggerType(value)}
                value={triggerType}
                required
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select trigger type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXACT_MATCH">Exact Match</SelectItem>
                  <SelectItem value="CONTAINS">Contains</SelectItem>
                  <SelectItem value="STARTS_WITH">Starts With</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="triggerValue" className="text-right">
                Trigger Value
              </Label>
              <Input
                id="triggerValue"
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                className="col-span-3"
                placeholder="e.g., 'hello', 'support', 'pricing'"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="responseMessage" className="text-right">
                Response Messages
              </Label>
              <Textarea
                id="responseMessage"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                className="col-span-3"
                placeholder="Enter multiple messages, each on a new line.&#10;e.g., 'Hi there! How can I help you?'&#10;'Please choose an option below.'"
                required
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChatbotRuleDialog;