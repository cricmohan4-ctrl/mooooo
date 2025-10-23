"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Trash2, Edit, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import AddEditFormDialog from '@/components/AddEditFormDialog';
import { Form } from '@/types/form';

const FormBuilderPage = () => {
  const { user } = useSession();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddFormDialogOpen, setIsAddFormDialogOpen] = useState(false);
  const [isEditFormDialogOpen, setIsEditFormDialogOpen] = useState(false);
  const [selectedFormToEdit, setSelectedFormToEdit] = useState<Form | null>(null);

  const fetchForms = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("id, name, description, form_definition, created_at, updated_at, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error: any) {
      console.error("Error fetching forms:", error.message);
      showError("Failed to load forms.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleDeleteForm = async (formId: string, formName: string) => {
    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", formId);

      if (error) throw error;

      showSuccess(`Form "${formName}" deleted successfully!`);
      fetchForms();
    } catch (error: any) {
      console.error("Error deleting form:", error.message);
      showError(`Failed to delete form: ${error.message}`);
    }
  };

  const handleEditFormClick = (form: Form) => {
    setSelectedFormToEdit(form);
    setIsEditFormDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      fetchForms();
    }
  }, [user, fetchForms]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold ml-4">Form Builder</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" onClick={fetchForms} title="Refresh Forms">
            <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Button>
          <AddEditFormDialog
            isOpen={isAddFormDialogOpen}
            onOpenChange={setIsAddFormDialogOpen}
            onFormSaved={fetchForms}
          />
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-500">Loading forms...</div>
        ) : forms.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-500">
            No forms created yet. Click the '+' button to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <Card key={form.id} className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{form.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditFormClick(form)} title="Edit Form">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete Form">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the "{form.name}" form and all its associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteForm(form.id, form.name)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {form.description || "No description provided."}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Fields: {form.form_definition.length}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Created: {new Date(form.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedFormToEdit && (
        <AddEditFormDialog
          isOpen={isEditFormDialogOpen}
          onOpenChange={setIsEditFormDialogOpen}
          onFormSaved={fetchForms}
          initialForm={selectedFormToEdit}
        />
      )}
    </div>
  );
};

export default FormBuilderPage;