"use client";

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ManageLabelsDialog from '@/components/ManageLabelsDialog'; // Import the existing dialog

const LabelManagementPage = () => {
  const [isManageLabelsDialogOpen, setIsManageLabelsDialogOpen] = useState(false);

  // This function will be passed to the dialog to refresh data if needed
  const handleLabelsUpdated = () => {
    // In this context, the dialog itself handles fetching its own labels.
    // If there were other components on this page displaying labels, they would be refreshed here.
    console.log("Labels updated, refreshing view if necessary.");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold ml-4 text-gray-900 dark:text-gray-100">
            Label Management
          </h1>
        </div>
        <Button onClick={() => setIsManageLabelsDialogOpen(true)} title="Manage Labels">
          <PlusCircle className="h-4 w-4 mr-2" /> Manage Labels
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-medium">
            Manage Conversation Labels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Use the "Manage Labels" button to add, edit, or delete labels that can be applied to conversations.
            These labels are shared across all team members.
          </p>
          {/* The actual label list will be managed within the dialog itself */}
        </CardContent>
      </Card>

      <ManageLabelsDialog
        isOpen={isManageLabelsDialogOpen}
        onOpenChange={setIsManageLabelsDialogOpen}
        onLabelsUpdated={handleLabelsUpdated}
      />
    </div>
  );
};

export default LabelManagementPage;