import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageCircle, Trash2, Bot, MousePointerClick, Workflow, Inbox as InboxIcon, Edit, Brain, RefreshCw, Link as LinkIcon, TrendingUp, TrendingDown, Frown } from "lucide-react";
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadialBarChart, RadialBar, Legend } from 'recharts';

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

// Placeholder data for charts
const subscriberGrowthData = [
  { name: '21 Sep', uv: 0 }, { name: '22 Sep', uv: 0.5 }, { name: '23 Sep', uv: 1 }, { name: '24 Sep', uv: 0.5 },
  { name: '25 Sep', uv: 2 }, { name: '26 Sep', uv: 1 }, { name: '27 Sep', uv: 0.5 }, { name: '28 Sep', uv: 1 },
  { name: '29 Sep', uv: 0.5 }, { name: '30 Sep', uv: 1 }, { name: '01 Oct', uv: 0.5 }, { name: '02 Oct', uv: 0.5 },
  { name: '03 Oct', uv: 0.5 }, { name: '04 Oct', uv: 0.5 }, { name: '05 Oct', uv: 1 }, { name: '06 Oct', uv: 1 },
  { name: '07 Oct', uv: 1.5 }, { name: '08 Oct', uv: 1 }, { name: '09 Oct', uv: 1.5 }, { name: '10 Oct', uv: 2 },
  { name: '11 Oct', uv: 1.5 }, { name: '12 Oct', uv: 1 }, { name: '13 Oct', uv: 1.5 }, { name: '14 Oct', uv: 2 },
  { name: '15 Oct', uv: 2.5 }, { name: '16 Oct', uv: 3 }, { name: '17 Oct', uv: 2.5 }, { name: '18 Oct', uv: 2 },
  { name: '19 Oct', uv: 2.5 }, { name: '20 Oct', uv: 3 }, { name: '21 Oct', uv: 2.5 },
];

const subscriberSummaryData = [
  { name: 'Mon', gain: 5, drop: 1 },
  { name: 'Tue', gain: 7, drop: 2 },
  { name: 'Wed', gain: 3, drop: 0 },
  { name: 'Thu', gain: 6, drop: 1 },
  { name: 'Fri', gain: 8, drop: 3 },
  { name: 'Sat', gain: 4, drop: 0 },
  { name: 'Sun', gain: 9, drop: 2 },
];

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* WhatsApp Summary Cards */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">WhatsApp Summary (all time)</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Widget</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">WhatsApp Summary (all time)</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sequence</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">WhatsApp Summary (all time)</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Input Flow</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">WhatsApp Summary (all time)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Subscriber Growth Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Subscriber Growth <span className="text-sm text-muted-foreground">(last 30 days)</span></CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={subscriberGrowthData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                <YAxis className="text-xs text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                <Area type="monotone" dataKey="uv" stroke="#28a745" fill="#28a745" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscriber Weekly Comparison */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Subscriber Weekly Comparison</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                barSize={10}
                data={[{ name: 'Subscribers', value: 10, fill: '#3b82f6' }]} // Blue color
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar minAngle={15} clockWise dataKey="value" />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-foreground">
                  10
                </text>
                <text x="50%" y="40%" textAnchor="middle" dominantBaseline="middle" className="text-sm fill-muted-foreground">
                  Subscribers
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-4">From Last Week</p>
            <p className="text-lg font-semibold text-brand-green">+5 (100%)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Subscriber Summary */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Subscriber Summary <span className="text-sm text-muted-foreground">(last 7 days)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around mb-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 text-brand-green mx-auto mb-1" />
                <p className="text-xl font-bold">10</p>
                <p className="text-sm text-muted-foreground">Gain</p>
              </div>
              <div className="text-center">
                <TrendingDown className="h-6 w-6 text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Drop</p>
              </div>
              <div className="text-center">
                <Users className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-bold">10</p>
                <p className="text-sm text-muted-foreground">Sum</p>
              </div>
            </div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subscriberSummaryData}>
                  <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                  <YAxis className="text-xs text-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                  <Bar dataKey="gain" fill="#82ca9d" name="Gain" />
                  <Bar dataKey="drop" fill="#ffc658" name="Drop" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Broadcast Summary */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Broadcast Summary <span className="text-sm text-muted-foreground">(last 7 days)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[250px] space-y-4">
              <div className="text-center p-4 bg-blue-500 text-white rounded-lg w-full max-w-[150px]">
                <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm">Sent</p>
              </div>
              <div className="text-center p-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg w-full max-w-[150px]">
                <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Broadcast */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Upcoming Broadcast <span className="text-sm text-brand-green">Next 7 days</span></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[250px] text-center">
            <Frown className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">You do not have any broadcast scheduled.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* WhatsApp Accounts Section */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-medium">
              WhatsApp Accounts
            </CardTitle>
            <div className="flex space-x-2">
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