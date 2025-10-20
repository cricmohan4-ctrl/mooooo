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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
  access_token: string; // We'll fetch this to pre-fill, but not display
}

interface OpenAIConfig {
  id: string;
  openai_api_key: string;
  is_enabled: boolean;
  system_prompt: string | null;
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
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAiConfigLoading, setIsAiConfigLoading] = useState(true);

  useEffect(() => {
    setAccountName(account.account_name);
    setPhoneNumberId(account.phone_number_id);
    // Do NOT set accessToken here for security reasons. User must re-enter if needed.
    setAccessToken(""); 
    
    const fetchOpenAIConfig = async () => {
      if (!user || !account.id) return;
      setIsAiConfigLoading(true);
      try {
        const { data, error } = await supabase
          .from("openai_configs")
          .select("openai_api_key, is_enabled, system_prompt")
          .eq("whatsapp_account_id", account.id)
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          throw error;
        }

        if (data) {
          // Do NOT pre-fill openaiApiKey for security. User must re-enter if needed.
          setOpenaiApiKey(""); 
          setIsAiEnabled(data.is_enabled);
          setSystemPrompt(data.system_prompt || "");
        } else {
          // Reset if no config found
          setOpenaiApiKey("");
          setIsAiEnabled(false);
          setSystemPrompt("");
        }
      } catch (error: any) {
        console.error("Error fetching OpenAI config:", error.message);
        showError("Failed to load AI assistant configuration.");
      } finally {
        setIsAiConfigLoading(false);
      }
    };

    if (isOpen) {
      fetchOpenAIConfig();
    }
  }, [account, user, isOpen]);

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

      // Update or Insert OpenAI Config
      if (isAiEnabled && !openaiApiKey.trim()) {
        showError("OpenAI API Key is required if AI assistant is enabled.");
        setIsLoading(false);
        return;
      }

      const { data: existingAiConfig, error: fetchAiConfigError } = await supabase
        .from("openai_configs")
        .select("id")
        .eq("whatsapp_account_id", account.id)
        .single();

      if (fetchAiConfigError && fetchAiConfigError.code !== 'PGRST116') {
        throw fetchAiConfigError;
      }

      if (existingAiConfig) {
        // Update existing config
        const updateAiConfigPayload: { openai_api_key?: string; is_enabled: boolean; system_prompt: string | null } = {
          is_enabled: isAiEnabled,
          system_prompt: systemPrompt.trim() || null,
        };
        if (openaiApiKey.trim()) {
          updateAiConfigPayload.openai_api_key = openaiApiKey.trim();
        }

        const { error: updateAiError } = await supabase
          .from("openai_configs")
          .update(updateAiConfigPayload)
          .eq("id", existingAiConfig.id)
          .eq("user_id", user.id);

        if (updateAiError) throw updateAiError;
      } else if (isAiEnabled && openaiApiKey.trim()) {
        // Insert new config
        const { error: insertAiError } = await supabase
          .from("openai_configs")
          .insert({
            whatsapp_account_id: account.id,
            user_id: user.id,
            openai_api_key: openaiApiKey.trim(),
            is_enabled: isAiEnabled,
            system_prompt: systemPrompt.trim() || null,
          });

        if (insertAiError) throw insertAiError;
      } else if (!isAiEnabled && existingAiConfig) {
        // If AI is disabled and a config exists, we could delete it or just disable it.
        // For now, let's just update is_enabled to false.
        const { error: disableAiError } = await supabase
          .from("openai_configs")
          .update({ is_enabled: false })
          .eq("id", existingAiConfig.id)
          .eq("user_id", user.id);
        if (disableAiError) throw disableAiError;
      }


      showSuccess("WhatsApp account and AI settings updated successfully!");
      onOpenChange(false);
      onAccountUpdated();
    } catch (error: any) {
      console.error("Error updating WhatsApp account or AI config:", error.message);
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
            Update your WhatsApp Business Account details and configure AI assistant settings.
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

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold col-span-4">AI Assistant Configuration</h3>
            {isAiConfigLoading ? (
              <div className="col-span-4 text-center text-gray-500">Loading AI config...</div>
            ) : (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isAiEnabled" className="text-right">
                    Enable AI Assistant
                  </Label>
                  <Switch
                    id="isAiEnabled"
                    checked={isAiEnabled}
                    onCheckedChange={setIsAiEnabled}
                    className="col-span-3 justify-self-start"
                  />
                </div>

                {isAiEnabled && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="openaiApiKey" className="text-right">
                        OpenAI API Key
                      </Label>
                      <Input
                        id="openaiApiKey"
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        className="col-span-3"
                        placeholder="sk-..."
                        required={isAiEnabled}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="systemPrompt" className="text-right pt-2">
                        System Prompt
                      </Label>
                      <Textarea
                        id="systemPrompt"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="col-span-3"
                        rows={5}
                        placeholder="You are a helpful AI assistant for a business. Respond concisely and professionally."
                      />
                    </div>
                  </>
                )}
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

export default EditWhatsappAccountDialog;