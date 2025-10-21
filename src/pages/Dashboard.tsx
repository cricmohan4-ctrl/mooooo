import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError } from "@/utils/toast";
import { Link } from "react-router-dom"; // Keep Link for potential future dashboard links

// Define interfaces if needed for other dashboard components,
// but for now, we'll keep it minimal as Chatbot Rules are moved.

const Dashboard = () => {
  const { user } = useSession();
  // Removed all chatbot rules related states and functions

  // Example of a simple dashboard content after moving rules
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        {/* Refresh button for general dashboard data, if any */}
        <Button variant="ghost" size="icon" onClick={() => { /* Implement dashboard data refresh if needed */ }} title="Refresh Data">
          <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-medium">Welcome to your Dashboard!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This is your central hub. Use the sidebar to navigate to different sections of your application.
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              You can manage your WhatsApp accounts under "Connect Account" and set up automated responses in "Chatbot Rules".
            </p>
            <div className="mt-6 flex space-x-4">
              <Link to="/connect-account">
                <Button>Connect WhatsApp Account</Button>
              </Link>
              <Link to="/chatbot-rules">
                <Button variant="secondary">Manage Chatbot Rules</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;