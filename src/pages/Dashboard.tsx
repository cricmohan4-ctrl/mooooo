import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageCircle, Trash2 } from "lucide-react";
import AddWhatsappAccountDialog from "@/components/AddWhatsappAccountDialog";
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

interface WhatsappAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
}

const Dashboard = () => {
  const { user } = useSession();
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsappAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  const fetchWhatsappAccounts = async () => {
    if (!user) return;
    setIsLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, account_name, phone_number_id")
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

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", user?.id); // Ensure user can only delete their own accounts

      if (error) {
        throw error;
      }
      showSuccess("WhatsApp account deleted successfully!");
      fetchWhatsappAccounts(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting WhatsApp account:", error.message);
      showError(`Failed to delete account: ${error.message}`);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWhatsappAccounts();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          WhatsApp Automation Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* WhatsApp Accounts Section */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">
                WhatsApp Accounts
              </CardTitle>
              <AddWhatsappAccountDialog onAccountAdded={fetchWhatsappAccounts} />
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
                        <MessageCircle className="h-5 w-5 text-green-500 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{account.account_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">ID: {account.phone_number_id}</p>
                        </div>
                      </div>
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI & WhatsApp API Keys Section */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-medium">
                AI & WhatsApp API Keys
              </CardTitle>
              <Button variant="outline" size="icon">
                <PlusCircle className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Configure your API keys for AI services (e.g., ChatGPT, Google API) and WhatsApp Business API.
              </p>
              <div className="mt-4 text-center text-gray-500 dark:text-gray-500">
                No API keys configured yet.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;