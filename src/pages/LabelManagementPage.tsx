"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddLabelDialog from '@/components/AddLabelDialog'; // Import the new dialog
import LabelListAndActions from '@/components/LabelListAndActions'; // Import the refactored component
import { useSession } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';

const LabelManagementPage = () => {
  const { user: currentUser } = useSession();
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);

  const fetchCurrentUserRole = useCallback(async () => {
    if (!currentUser) {
      setUserRole(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      setUserRole(data?.role || 'user'); // Default to user role on error
    } catch (error: any) {
      console.error("Error fetching current user role for Label Management:", error.message);
      setUserRole('user'); // Default to user role on error
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchCurrentUserRole();
    }
  }, [currentUser, fetchCurrentUserRole]);

  // This function will be passed to the dialog to refresh data if needed
  const handleLabelsUpdated = () => {
    // Trigger a re-fetch in LabelListAndActions
    // The LabelListAndActions component will handle its own data fetching
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
        {userRole && (userRole === 'admin' || userRole === 'user') && ( // Allow both roles to add their own labels
          <AddLabelDialog onLabelAdded={handleLabelsUpdated} />
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-medium">
            Manage Conversation Labels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create, edit, delete, and assign labels to users. Labels are used to categorize conversations.
          </p>
          <LabelListAndActions onLabelsUpdated={handleLabelsUpdated} userRole={userRole} />
        </CardContent>
      </Card>
    </div>
  );
};

export default LabelManagementPage;