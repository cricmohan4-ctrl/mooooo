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
import { XCircle, Edit } from "lucide-react";
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

interface ButtonConfig {
  text: string;
  payload: string;
}

interface ChatbotRule {
  id: string;
  whatsapp_account_id: string;
  trigger_value: string;
  trigger_type: "EXACT_MATCH" | "CONTAINS" | "STARTS_WITH";
  response_message: string[];
  buttons?: ButtonConfig[] | null;
  account_name?: string; // For display purposes, not directly updated
}

interface EditChatbotRuleDialogProps {
  rule: ChatbotRule;
  whatsappAccounts: { id: string; account_name: string }[];
  onRuleUpdated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditChatbotRuleDialog: React.FC<EditChatbotRuleDialogProps> = ({
  rule,
  whatsappAccounts,
  onRuleUpdated,
  isOpen,
  onOpenChange,
}) => {
  const { user } = useSession();
  const [selectedWhatsappAccountId, setSelectedWhatsappAccountId] = useState<string>(rule.whatsapp_account_id);
  const [triggerValue, setTriggerValue] = useState(rule.trigger_value);
  const [triggerType, setTriggerType] = useState<"EXACT_MATCH" | "CONTAINS" | "STARTS_WITH">(rule.trigger_type);
  const [responseMessage, setResponseMessage] = useState(rule.response_message.join('\n'));
  const [buttons, setButtons] = useState<ButtonConfig[]>(rule.buttons ? [...rule.buttons] : []);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when the rule prop changes (e.g., if a different rule is selected for editing)
  useEffect(() => {
    setSelectedWhatsappAccountId(rule.whatsapp_account_id);
    setTriggerValue(rule.trigger_value);
    setTriggerType(rule.trigger_type);
    setResponseMessage(rule.response_message.join('\n'));
    setButtons(rule.buttons ? [...rule.buttons] : []);
  }, [rule]);

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
      showError("You must be logged in to edit a chatbot rule.");
      return;
    }
    if (!selectedWhatsappAccountId || !triggerValue || !responseMessage.trim()) {
      showError("Please fill in all required fields.");
      return;
    }

    const invalidButtons = buttons.some(btn => !btn.text.trim() || !btn.payload.trim());
    if (buttons.length > 0 && invalidButtons) {
      showError("Please ensure all button text and payload values are filled.");
      return;
    }

    setIsLoading(true);
    try {
      const responseMessagesArray = responseMessage.split('\n').map(msg => msg.trim()).filter(msg => msg.length > 0);

      const { error } = await supabase
        .from("chatbot_rules")
        .update({
          whatsapp_account_id: selectedWhatsappAccountId,
          trigger_value: triggerValue,
          trigger_type: triggerType,
          response_message: responseMessagesArray,
          buttons: buttons.length > 0 ? buttons : null,
        })
        .eq("id", rule.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      showSuccess("Chatbot rule updated successfully!");
      onOpenChange(false); // Close dialog
      onRuleUpdated(); // Notify parent to refresh
    } catch (error: any) {
      console.error("Error updating chatbot rule:", error.message);
      showError(`Failed to update rule: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Chatbot Rule</DialogTitle>
          <DialogDescription>
            Modify the trigger and response for this chatbot rule. Each line in the response will be a separate message.
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
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditChatbotRuleDialog;