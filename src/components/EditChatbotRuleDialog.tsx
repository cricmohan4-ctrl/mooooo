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
import { XCircle } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface ButtonConfig {
  text: string;
  payload: string;
}

interface ChatbotFlow {
  id: string;
  name: string;
}

interface ChatbotRule {
  id: string;
  whatsapp_account_id: string;
  trigger_value: string;
  trigger_type: "EXACT_MATCH" | "CONTAINS" | "STARTS_WITH";
  response_message: string[];
  buttons?: ButtonConfig[] | null;
  flow_id?: string | null; // New field
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
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(rule.flow_id || null); // Initialize with rule's flow_id
  const [chatbotFlows, setChatbotFlows] = useState<ChatbotFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when the rule prop changes (e.g., if a different rule is selected for editing)
  useEffect(() => {
    setSelectedWhatsappAccountId(rule.whatsapp_account_id);
    setTriggerValue(rule.trigger_value);
    setTriggerType(rule.trigger_type);
    setResponseMessage(rule.response_message.join('\n'));
    setButtons(rule.buttons ? [...rule.buttons] : []);
    setSelectedFlowId(rule.flow_id || null);
  }, [rule]);

  useEffect(() => {
    const fetchChatbotFlows = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("chatbot_flows")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name", { ascending: true });

        if (error) throw error;
        setChatbotFlows(data || []);
      } catch (error: any) {
        console.error("Error fetching chatbot flows:", error.message);
        showError("Failed to load chatbot flows for selection.");
      }
    };

    if (user && isOpen) {
      fetchChatbotFlows();
    }
  }, [user, isOpen]);

  const handleAddButton = () => {
    setButtons([...buttons, { text: "", payload: "" }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof ButtonConfig, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setEditedButtons(newButtons);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to edit a chatbot rule.");
      return;
    }
    if (!selectedWhatsappAccountId || !triggerValue.trim()) {
      showError("Please fill in all required fields (WhatsApp Account, Trigger Value).");
      return;
    }

    if (!selectedFlowId && !responseMessage.trim()) {
      showError("Please provide a response message or select a chatbot flow.");
      return;
    }

    if (!selectedFlowId && buttons.length > 0) {
      const invalidButtons = buttons.some(btn => !btn.text.trim() || !btn.payload.trim());
      if (invalidButtons) {
        showError("Please ensure all button text and payload values are filled.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const responseMessagesArray = selectedFlowId ? [] : responseMessage.split('\n').map(msg => msg.trim()).filter(msg => msg.length > 0);

      const { error } = await supabase
        .from("chatbot_rules")
        .update({
          whatsapp_account_id: selectedWhatsappAccountId,
          trigger_value: triggerValue,
          trigger_type: triggerType,
          response_message: responseMessagesArray,
          buttons: selectedFlowId ? null : (buttons.length > 0 ? buttons : null),
          flow_id: selectedFlowId, // Update the flow ID
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
            Modify the trigger and either the automated response or linked chatbot flow for this rule.
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

            <Separator className="my-2" />

            {/* Flow Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="chatbotFlow" className="text-right">
                Link to Flow (Optional)
              </Label>
              <Select
                onValueChange={(value) => setSelectedFlowId(value === "none" ? null : value)}
                value={selectedFlowId || "none"}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a chatbot flow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Flow (Use static response)</SelectItem>
                  {chatbotFlows.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      {flow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Response Message and Buttons */}
            {!selectedFlowId && (
              <>
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
                    required={!selectedFlowId}
                    rows={4}
                  />
                </div>

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
              </>
            )}
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