"use client";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Trash2, Edit, Brain, PlusCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AddWhatsappAccountDialog from "@/components/AddWhatsappAccountDialog";
import EditWhatsappAccountDialog from "@/components/EditWhatsappAccountDialog";
import GeminiConfigDialog from "@/components/GeminiConfigDialog";
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
  access_token: string;
  gemini_system_instruction: string | null;
}

const ConnectAccount = () => {
  const { user } = useSession();
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsappAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
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
        .select("id, account_name, phone_number_id, access_token, gemini_system_instruction");
        // Removed .eq("user_id", user.id) to allow all authenticated users to see all accounts

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
        .eq("id", accountId);
        // RLS will enforce that only admins can delete

      if (error) {
        throw error;
      }
      showSuccess("WhatsApp account deleted successfully!");
      fetchWhatsappAccounts();
    } catch (error: any) {
      console.error("Error deleting WhatsApp account:", error.message);
      showError(`Failed to delete account: ${error.message}`);
    }
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
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-4">Connect WhatsApp Account</h1>
      </div>

      <Card className="shadow-lg flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-medium">
            WhatsApp Accounts
          </CardTitle>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" onClick={fetchWhatsappAccounts} title="Refresh Accounts">
              <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </Button>
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

export default ConnectAccount;