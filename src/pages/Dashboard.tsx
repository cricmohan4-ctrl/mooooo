import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageCircle, Trash2, Bot, MousePointerClick, Workflow, Inbox as InboxIcon, Edit, Brain, RefreshCw, Link as LinkIcon, TrendingUp, TrendingDown, Frown, Users } from "lucide-react";
import AddWhatsappAccountDialog from "@/components/AddWhatsappAccountDialog";
import EditWhatsappAccountDialog from "@/components/EditWhatsappAccountDialog";
import AddChatbotRuleDialog from "@/components/AddChatbotRuleDialog";
import EditChatbotRuleDialog from "@/components/EditChatbotRuleDialog";
import GeminiConfigDialog from "@/components/GeminiConfigDialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError, showSuccess } from "@/utils/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
  access_token: string;
  gemini_system_instruction: string | null;
}

interface ButtonConfig {
  text: string;
  payload: string;
}

interface ChatbotRule {
  id: string;
  whatsapp_account_id: string;
  trigger_value: string;
  trigger_type: "EXACT_MATCH" | "CONTAINS" | "STARTS_WITH" | "AI_RESPONSE";
  response_message: string[];
  buttons?: ButtonConfig[] | null;
  flow_id?: string | null;
  use_ai_response: boolean;
  account_name?: string;
  flow_name?: string;
}

const Dashboard = () => {
  const { user } = useSession();
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsappAccount[]>([]);
  const [chatbotRules, setChatbotRules] = useState<ChatbotRule[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [isEditRuleDialogOpen, setIsEditRuleDialogOpen] = useState(false);
  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<ChatbotRule | null>(null);
  const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = useState(false);
  const [selectedAccountToEdit, setSelectedAccountToEdit] = useState<WhatsappAccount | null>(null);
  const [isGeminiConfigDialogOpen, setIsGeminiConfigDialogOpen] = useState(false);
  const [selectedAccountForGeminiConfig, setSelectedAccountForGeminiConfig] = useState<WhatsappAccount | null>(null);

  const fetchWhatsappAccounts = async () => {
    if (!user) return;
    setIsLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, account_name, phone_number_id, access_token, gemini_system_instruction")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
      setWhatsappAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching WhatsApp accounts:", error.message);
      showError("Failed to load WhatsApp accounts.");
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchChatbotRules = async () => {
    if (!user) return;
    setIsLoadingRules(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_rules")
        .select("id, whatsapp_account_id, trigger_value, trigger_type, response_message, buttons, flow_id, use_ai_response, whatsapp_accounts(account_name), chatbot_flows(name)")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
      const rulesWithAccountAndFlowNames = data?.map(rule => ({
        ...rule,
        account_name: (rule.whatsapp_accounts as { account_name: string }).account_name,
        flow_name: rule.chatbot_flows ? (rule.chatbot_flows as { name: string }).name : undefined,
      })) || [];
      setChatbotRules(rulesWithAccountAndFlowNames);
    } catch (error: any) {
      console.error("Error fetching chatbot rules:", error.message);
      showError("Failed to load chatbot rules.");
    } finally {
      setIsLoadingRules(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", user?.id);

      if (error) {
        throw error;
      }
      showSuccess("WhatsApp account deleted successfully!");
      fetchWhatsappAccounts();
      fetchChatbotRules();
    } catch (error: any) {
      console.error("Error deleting WhatsApp account:", error.message);
      showError(`Failed to delete account: ${error.message}`);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("chatbot_rules")
        .delete()
        .eq("id", ruleId)
        .eq("user_id", user?.id);

      if (error) {
        throw error;
      }
      showSuccess("Chatbot rule deleted successfully!");
      fetchChatbotRules();
    } catch (error: any) {
      console.error("Error deleting chatbot rule:", error.message);
      showError(`Failed to delete rule: ${error.message}`);
    }
  };

  const handleEditRuleClick = (rule: ChatbotRule) => {
    setSelectedRuleToEdit(rule);
    setIsEditRuleDialogOpen(true);
  };

  const handleEditAccountClick = (account: WhatsappAccount) => {
    setSelectedAccountToEdit(account);
    setIsEditAccountDialogOpen(true);
  };

  const handleConfigureGeminiClick = (account: WhatsappAccount) => {
    setSelectedAccountForGeminiConfig(account);
    setIsGeminiConfigDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      fetchWhatsappAccounts();
      fetchChatbotRules();
    }
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <Button variant="ghost" size="icon" onClick={() => { fetchWhatsappAccounts(); fetchChatbotRules(); }} title="Refresh Data">
          <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* WhatsApp Accounts Section */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-medium">
              WhatsApp Accounts
            </CardTitle>
            <div className="flex space-x-2">
              <Link to="/connect-account"> {/* Added Link to ConnectAccount */}
                <Button variant="outline" size="icon" title="Connect New Account">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/inbox">
                <Button variant="outline" size="icon" title="Go to Inbox">
                  <InboxIcon className="h-4 w-4" />
                </Button>
              </Link>
              <AddWhatsappAccountDialog onAccountAdded={fetchWhatsappAccounts} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Manage your connected WhatsApp Business accounts here.
            </p>
            {isLoadingAccounts ? (
              <div className="text-center text-gray-500 dark:text-gray-500">Loading accounts...</div>
            ) : whatsappAccounts.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-500">
                No accounts added yet. Click the '+' button to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {whatsappAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center">
                      <MessageCircle className="h-5 w-5 text-brand-green mr-3" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{account.account_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ID: {account.phone_number_id}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleConfigureGeminiClick(account)} title="Configure AI">
                        <Brain className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditAccountClick(account)} title="Edit Account">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your WhatsApp account
                              entry and remove its association from your dashboard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAccount(account.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chatbot Rules Section */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-medium">
              Chatbot Rules
            </CardTitle>
            <div className="flex space-x-2">
              <Link to="/flows">
                <Button variant="outline" size="icon" title="Go to Flow Builder">
                  <Workflow className="h-4 w-4" />
                </Button>
              </Link>
              <AddChatbotRuleDialog onRuleAdded={fetchChatbotRules} whatsappAccounts={whatsappAccounts} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Define automated responses for your WhatsApp accounts based on trigger phrases.
            </p>
            {isLoadingRules ? (
              <div className="text-center text-gray-500 dark:text-gray-500">Loading rules...</div>
            ) : chatbotRules.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-500">
                No chatbot rules defined yet. Click the '+' button to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {chatbotRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center mb-1">
                        <Bot className="h-5 w-5 text-blue-500 mr-3" />
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          Trigger: <span className="font-normal text-gray-700 dark:text-gray-300">[{rule.trigger_type}] "{rule.trigger_value}"</span>
                        </p>
                      </div>
                      {rule.use_ai_response ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
                          Response: <span className="font-medium text-purple-600 dark:text-purple-400">AI Generated</span>
                        </p>
                      ) : rule.flow_id ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
                          Linked Flow: <span className="font-medium text-blue-600 dark:text-blue-400">{rule.flow_name || 'Unnamed Flow'}</span>
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
                            Response Messages:
                            {rule.response_message.map((msg, index) => (
                              <span key={index} className="block ml-2">"{msg}"</span>
                            ))}
                          </p>
                          {rule.buttons && rule.buttons.length > 0 && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 ml-8 mt-2">
                              Buttons:
                              {rule.buttons.map((button, index) => (
                                <div key={index} className="flex items-center ml-2">
                                  <MousePointerClick className="h-3 w-3 mr-1" />
                                  <span className="font-medium">"{button.text}"</span> (Payload: "{button.payload}")
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1">Account: {rule.account_name || 'N/A'}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditRuleClick(rule)} title="Edit Rule">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete Rule">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this chatbot rule.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteRule(rule.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRuleToEdit && (
        <EditChatbotRuleDialog
          rule={selectedRuleToEdit}
          whatsappAccounts={whatsappAccounts}
          onRuleUpdated={fetchChatbotRules}
          isOpen={isEditRuleDialogOpen}
          onOpenChange={setIsEditRuleDialogOpen}
        />
      )}

      {selectedAccountToEdit && (
        <EditWhatsappAccountDialog
          account={selectedAccountToEdit}
          onAccountUpdated={fetchWhatsappAccounts}
          isOpen={isEditAccountDialogOpen}
          onOpenChange={setIsEditAccountDialogOpen}
        />
      )}

      {selectedAccountForGeminiConfig && (
        <GeminiConfigDialog
          account={selectedAccountForGeminiConfig}
          onConfigUpdated={fetchWhatsappAccounts}
          isOpen={isGeminiConfigDialogOpen}
          onOpenChange={setIsGeminiConfigDialogOpen}
        />
      )}
    </div>
  );
};

export default Dashboard;