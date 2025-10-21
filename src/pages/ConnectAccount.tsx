"use client";

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MessageSquare, Plug, CheckCircle } from 'lucide-react'; // Changed Whatsapp to MessageSquare
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';

const SUPABASE_PROJECT_ID = "bfnglcwayknwzcoelofy"; // Your Supabase Project ID
const WEBHOOK_CALLBACK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;
const WHATSAPP_VERIFY_TOKEN = import.meta.env.VITE_WHATSAPP_VERIFY_TOKEN || "YOUR_VERIFY_TOKEN_HERE"; // Ensure this is set in your .env file as VITE_WHATSAPP_VERIFY_TOKEN

const ConnectAccount = () => {
  const { user } = useSession();
  const [accountName, setAccountName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAlternativeConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to connect a WhatsApp account.");
      return;
    }
    if (!accountName || !phoneNumberId || !accessToken) {
      showError("Please fill in all fields for the alternative connection.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .insert({
          user_id: user.id,
          account_name: accountName,
          phone_number_id: phoneNumberId,
          access_token: accessToken,
        });

      if (error) {
        throw error;
      }

      showSuccess("WhatsApp account connected successfully!");
      setAccountName("");
      setPhoneNumberId("");
      setAccessToken("");
    } catch (error: any) {
      console.error("Error connecting WhatsApp account:", error.message);
      showError(`Failed to connect account: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder for the one-click integration (Meta Embedded Signup Flow)
  const handleOneClickConnect = () => {
    showError("One-click integration is a placeholder. Please use the alternative method for now.");
    // In a real application, this would redirect to Meta's embedded signup flow
    // window.open('https://www.facebook.com/v19.0/dialog/oauth?client_id={APP_ID}&redirect_uri={REDIRECT_URI}&scope=whatsapp_business_management,whatsapp_business_messaging', '_blank');
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommended Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Connect WhatsApp Business (Recommended)</CardTitle>
            <p className="text-sm text-muted-foreground">One Click Business Integration</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white" onClick={handleOneClickConnect}>
              <MessageSquare className="h-5 w-5 mr-2" /> Connect WhatsApp
            </Button>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 text-brand-green mr-2 mt-1 flex-shrink-0" />
                The seamless integration will open in a pop-up. Make sure your browser is not blocking pop-ups.
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 text-brand-green mr-2 mt-1 flex-shrink-0" />
                You will be asked to provide a phone number for WhatsApp Business integration. We strongly recommend using a new phone number.
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 text-brand-green mr-2 mt-1 flex-shrink-0" />
                However, if you already have a WhatsApp account associated with that number, back up your WhatsApp data and then delete that account.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Alternative Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Connect WhatsApp Business (Alternative)</CardTitle>
            <p className="text-sm text-muted-foreground">Connect your WhatsApp account</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAlternativeConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="e.g., My Business Account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">WhatsApp Business Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="From Meta Developer Dashboard"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Bearer token from Meta"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-brand-green hover:bg-brand-green/90 text-white" disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            </form>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <Label className="font-semibold">Webhook Callback URL</Label>
                <p className="break-all text-blue-600 dark:text-blue-400">{WEBHOOK_CALLBACK_URL}</p>
              </div>
              <div>
                <Label className="font-semibold">Verify Token</Label>
                <p className="break-all">{WHATSAPP_VERIFY_TOKEN}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Privacy Policy URL</Label>
                  <p className="break-all text-blue-600 dark:text-blue-400">https://dash.botbiz.io/policy/privacy</p> {/* Placeholder */}
                </div>
                <div>
                  <Label className="font-semibold">Terms of Service URL</Label>
                  <p className="break-all text-blue-600 dark:text-blue-400">https://dash.botbiz.io/policy/terms</p> {/* Placeholder */}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConnectAccount;