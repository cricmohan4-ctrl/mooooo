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
import { PlusCircle, XCircle } from "lucide-react";
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

interface ButtonConfig {
  text: string;
  payload: string; // This will be the trigger_value for the next rule
}

const AddChatbotRuleDialog: React.FC<AddChatbotRuleDialogProps> = ({ onRuleAdded, whatsappAccounts }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWhatsappAccountId, setSelectedWhatsappAccountId] = useState<string>("");
  const [triggerValue, setTriggerValue] = useState("");
  const [triggerType, setTriggerType] = useState<"EXACT_MATCH" | "CONTAINS" | "STARTS_WITH">("EXACT_MATCH");
  const [responseMessage, setResponseMessage] = useState(""); // This will be a multi-line string
  const [buttons, setButtons] = useState<ButtonConfig[]>([]); // State for buttons
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (whatsappAccounts.length > 0 && !selectedWhatsappAccountId) {
      setSelectedWhatsappAccountId(whatsappAccounts[0].id);
    }
  }, [whatsappAccounts, selectedWhatsappAccountId]);

  const handleAddButton = () => {
    setButtons([...buttons, { text: "", payload: "" }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof ButtonConfig, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

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

    // Validate buttons: ensure text and payload are not empty if buttons exist
    const invalidButtons = buttons.some(btn => !btn.text.trim() || !btn.payload.trim());
    if (buttons.length > 0 && invalidButtons) {
      showError("Please ensure all button text and payload values are filled.");
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
          buttons: buttons.length > 0 ? buttons : null, // Store buttons if present, otherwise null
        });

      if (error) {
        throw error;
      }

      showSuccess("Chatbot rule added successfully!");
      setTriggerValue("");
      setResponseMessage("");
      setTriggerType("EXACT_MATCH");
      setButtons([]); // Clear buttons after submission
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

            {/* Buttons Section */}
            <div className="col-span-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-right">Buttons (Optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddButton} disabled={buttons.length >= 3}>
                  Add Button
                </Button>
              </div>
              <div className="space-y-2">
                {buttons.map((button, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Button Text"
                      value={button.text}
                      onChange={(e) => handleButtonChange(index, "text", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Payload (triggers next rule)"
                      value={button.payload}
                      onChange={(e) => handleButtonChange(index, "payload", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveButton(index)}
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
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