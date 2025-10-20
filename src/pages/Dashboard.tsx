import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const Dashboard = () => {
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
              <Button variant="outline" size="icon">
                <PlusCircle className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your connected WhatsApp Business accounts here.
              </p>
              <div className="mt-4 text-center text-gray-500 dark:text-gray-500">
                No accounts added yet.
              </div>
            </CardContent>
          </Card>

          {/* API Keys Section */}
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