"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, RefreshCw, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';

interface AIIntegration {
  id?: string;
  user_id: string;
  provider: 'openai' | 'gemini' | 'deepseek';
  secret_key: string | null;
  prompt_model: string | null;
  system_instruction: string | null;
}

const AIIntegrationPage = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for OpenAI
  const [openAiEnabled, setOpenAiEnabled] = useState(false);
  const [openAiSecretKey, setOpenAiSecretKey] = useState("");
  const [openAiPromptModel, setOpenAiPromptModel] = useState("");
  const [openAiSystemInstruction, setOpenAiSystemInstruction] = useState("");

  // State for Gemini (already integrated, but showing how it would be configured here)
  const [geminiEnabled, setGeminiEnabled] = useState(false); // Changed to false to disable by default
  const [geminiSecretKey, setGeminiSecretKey] = useState(""); // Gemini key is an env var, not user-configurable here
  const [geminiPromptModel, setGeminiPromptModel] = useState("gemini-2.5-flash");
  const [geminiSystemInstruction, setGeminiSystemInstruction] = useState("You are a helpful customer service assistant for a business selling plastic mobile covers with customer photos. You must answer in the language the user asks in. The price for Cash on Delivery (COD) is 220. The price for prepaid orders is 150. All orders are delivered within 7 days.");

  // State for DeepSeek
  const [deepSeekEnabled, setDeepSeekEnabled] = useState(false);
  const [deepSeekSecretKey, setDeepSeekSecretKey] = useState("");
  const [deepSeekPromptModel, setDeepSeekPromptModel] = useState("");
  const [deepSeekSystemInstruction, setDeepSeekSystemInstruction] = useState("");

  const fetchAIIntegrations = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_integrations')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const integrationsMap = new Map<string, AIIntegration>();
      data.forEach(integration => {
        integrationsMap.set(integration.provider, integration);
      });

      // Populate OpenAI state
      const openAiConfig = integrationsMap.get('openai');
      if (openAiConfig) {
        setOpenAiEnabled(true);
        setOpenAiSecretKey(openAiConfig.secret_key || "");
        setOpenAiPromptModel(openAiConfig.prompt_model || "");
        setOpenAiSystemInstruction(openAiConfig.system_instruction || "");
      } else {
        setOpenAiEnabled(false);
        setOpenAiSecretKey("");
        setOpenAiPromptModel("");
        setOpenAiSystemInstruction("");
      }

      // Populate DeepSeek state
      const deepSeekConfig = integrationsMap.get('deepseek');
      if (deepSeekConfig) {
        setDeepSeekEnabled(true);
        setDeepSeekSecretKey(deepSeekConfig.secret_key || "");
        setDeepSeekPromptModel(deepSeekConfig.prompt_model || "");
        setDeepSeekSystemInstruction(deepSeekConfig.system_instruction || "");
      } else {
        setDeepSeekEnabled(false);
        setDeepSeekSecretKey("");
        setDeepSeekPromptModel("");
        setDeepSeekSystemInstruction("");
      }

      // Gemini is currently managed via whatsapp_accounts.gemini_system_instruction
      // and GOOGLE_GEMINI_API_KEY env var. This section is for future expansion
      // if Gemini also needs per-user secret_key/model configuration here.
      // For now, we'll just display its default model and instruction.
      setGeminiEnabled(false); // Ensure it remains false after fetch
      setGeminiPromptModel("gemini-2.5-flash");
      setGeminiSystemInstruction("You are a helpful customer service assistant for a business selling plastic mobile covers with customer photos. You must answer in the language the user asks in. The price for Cash on Delivery (COD) is 220. The price for prepaid orders is 150. All orders are delivered within 7 days.");

    } catch (error: any) {
      console.error("Error fetching AI integrations:", error.message);
      showError("Failed to load AI integrations.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAIIntegrations();
    }
  }, [user, fetchAIIntegrations]);

  const handleSaveIntegration = async (provider: 'openai' | 'gemini' | 'deepseek', enabled: boolean, secretKey: string, promptModel: string, systemInstruction: string) => {
    if (!user) {
      showError("You must be logged in to save AI integrations.");
      return;
    }

    setIsSaving(true);
    try {
      if (enabled) {
        if (!secretKey.trim()) {
          showError(`Secret Key is required for ${provider}.`);
          return;
        }
        if (!promptModel.trim()) {
          showError(`Prompt Model is required for ${provider}.`);
          return;
        }

        const integrationData: Omit<AIIntegration, 'id'> = {
          user_id: user.id,
          provider,
          secret_key: secretKey.trim(),
          prompt_model: promptModel.trim(),
          system_instruction: systemInstruction.trim() || null,
        };

        const { error } = await supabase
          .from('ai_integrations')
          .upsert(integrationData, { onConflict: 'user_id,provider' });

        if (error) throw error;
        showSuccess(`${provider} integration saved successfully!`);
      } else {
        // If disabled, delete the integration
        const { error } = await supabase
          .from('ai_integrations')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', provider);

        if (error) throw error;
        showSuccess(`${provider} integration disabled and removed.`);
      }
      fetchAIIntegrations(); // Re-fetch to ensure UI is consistent
    } catch (error: any) {
      console.error(`Error saving ${provider} integration:`, error.message);
      showError(`Failed to save ${provider} integration: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-4">AI API Integration</h1>
      </div>

      <Card className="shadow-lg flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-medium">
            Configure AI Providers
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchAIIntegrations} title="Refresh Integrations">
            <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Manage your API keys and system instructions for various AI providers.
          </p>

          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-500">Loading AI integrations...</div>
          ) : (
            <div className="space-y-8">
              {/* OpenAI Configuration */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="openai-enabled"
                      checked={openAiEnabled}
                      onCheckedChange={setOpenAiEnabled}
                      disabled={isSaving}
                    />
                    <Label htmlFor="openai-enabled" className="text-lg font-semibold">OpenAI (ChatGPT)</Label>
                  </div>
                  <Button
                    onClick={() => handleSaveIntegration('openai', openAiEnabled, openAiSecretKey, openAiPromptModel, openAiSystemInstruction)}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save OpenAI"}
                  </Button>
                </div>
                {openAiEnabled && (
                  <div className="grid gap-4 pl-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="openai-secret-key">Secret Key</Label>
                        <Input
                          id="openai-secret-key"
                          type="password"
                          value={openAiSecretKey}
                          onChange={(e) => setOpenAiSecretKey(e.target.value)}
                          placeholder="sk-..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="openai-prompt-model">Prompt Model</Label>
                        <Select value={openAiPromptModel} onValueChange={setOpenAiPromptModel}>
                          <SelectTrigger id="openai-prompt-model" className="w-full mt-1">
                            <SelectValue placeholder="Select Model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="openai-system-instruction">Instruction to AI</Label>
                      <Textarea
                        id="openai-system-instruction"
                        value={openAiSystemInstruction}
                        onChange={(e) => setOpenAiSystemInstruction(e.target.value)}
                        placeholder="e.g., You are a helpful assistant..."
                        rows={5}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Gemini Configuration (Read-only for now, as it's configured per WhatsApp account) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="gemini-enabled"
                      checked={geminiEnabled}
                      onCheckedChange={setGeminiEnabled}
                      disabled={true} // Gemini is managed via whatsapp_accounts and env var
                    />
                    <Label htmlFor="gemini-enabled" className="text-lg font-semibold">Google Gemini</Label>
                  </div>
                  <Button variant="outline" disabled title="Gemini is configured per WhatsApp account">
                    <Brain className="h-4 w-4 mr-2" /> Managed per Account
                  </Button>
                </div>
                <div className="grid gap-4 pl-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">
                    Gemini integration is currently managed through the "Connect Account" page for each WhatsApp account's system instruction. The API key is set via environment variables.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Prompt Model</Label>
                      <Input value={geminiPromptModel} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Secret Key</Label>
                      <Input value="******** (Managed by Environment Variable)" disabled className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Default Instruction to AI</Label>
                    <Textarea
                      value={geminiSystemInstruction}
                      rows={5}
                      disabled
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* DeepSeek Configuration */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="deepseek-enabled"
                      checked={deepSeekEnabled}
                      onCheckedChange={setDeepSeekEnabled}
                      disabled={isSaving}
                    />
                    <Label htmlFor="deepseek-enabled" className="text-lg font-semibold">DeepSeek</Label>
                  </div>
                  <Button
                    onClick={() => handleSaveIntegration('deepseek', deepSeekEnabled, deepSeekSecretKey, deepSeekPromptModel, deepSeekSystemInstruction)}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save DeepSeek"}
                  </Button>
                </div>
                {deepSeekEnabled && (
                  <div className="grid gap-4 pl-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="deepseek-secret-key">Secret Key</Label>
                        <Input
                          id="deepseek-secret-key"
                          type="password"
                          value={deepSeekSecretKey}
                          onChange={(e) => setDeepSeekSecretKey(e.target.value)}
                          placeholder="sk-..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="deepseek-prompt-model">Prompt Model</Label>
                        <Select value={deepSeekPromptModel} onValueChange={setDeepSeekPromptModel}>
                          <SelectTrigger id="deepseek-prompt-model" className="w-full mt-1">
                            <SelectValue placeholder="Select Model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                            <SelectItem value="deepseek-coder">DeepSeek Coder</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="deepseek-system-instruction">Instruction to AI</Label>
                      <Textarea
                        id="deepseek-system-instruction"
                        value={deepSeekSystemInstruction}
                        onChange={(e) => setDeepSeekSystemInstruction(e.target.value)}
                        placeholder="e.g., You are a helpful assistant..."
                        rows={5}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIIntegrationPage;