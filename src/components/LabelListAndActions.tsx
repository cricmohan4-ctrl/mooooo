"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, XCircle, UserPlus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import LabelBadge from './LabelBadge';
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
import { Input } from '@/components/ui/input';
import AssignLabelToUserDialog from './AssignLabelToUserDialog'; // Import the new dialog

interface LabelItem {
  id: string;
  name: string;
  color: string;
  user_id: string;
  user_email?: string; // For display purposes
}

interface LabelListAndActionsProps {
  onLabelsUpdated: () => void;
  userRole: 'user' | 'admin' | null;
}

const defaultColors = [
  '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#6c757d', '#17a2b8', '#e83e8c'
];

const LabelListAndActions: React.FC<LabelListAndActionsProps> = ({ onLabelsUpdated, userRole }) => {
  const { user: currentUser } = useSession();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssignLabelDialogOpen, setIsAssignLabelDialogOpen] = useState(false);
  const [labelToAssign, setLabelToAssign] = useState<LabelItem | null>(null);

  const fetchLabels = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // Fetch labels and join with profiles to get user email for display
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select('id, name, color, user_id, profiles(first_name, last_name, id)') // Select user_id and profile info
        .order('name', { ascending: true });

      if (error) {
        console.error("Supabase error fetching labels:", error); // Log the full error object
        throw error;
      }

      const labelsWithUserDetails: LabelItem[] = data.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        user_id: label.user_id,
        user_email: label.profiles ? `${label.profiles.first_name || ''} ${label.profiles.last_name || ''}`.trim() || `User ID: ${label.user_id}` : `User ID: ${label.user_id}`,
      }));

      setLabels(labelsWithUserDetails);
    } catch (error: any) {
      console.error("Error fetching labels in LabelListAndActions:", error.message); // More specific log
      showError("Failed to load labels.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchLabels();
    }
  }, [currentUser]);

  const handleUpdateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editingLabel) return;
    if (!editingLabel.name.trim()) {
      showError("Label name cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_labels')
        .update({
          name: editingLabel.name.trim(),
          color: editingLabel.color,
        })
        .eq('id', editingLabel.id);
        // RLS will enforce that only admins can update any label, and users can update their own

      if (error) {
        if (error.code === '23505') { // Unique violation
          showError("A label with this name already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Label updated successfully!");
        setEditingLabel(null);
        fetchLabels(); // Re-fetch locally
        onLabelsUpdated(); // Notify parent
      }
    } catch (error: any) {
      console.error("Error updating label:", error.message);
      showError(`Failed to update label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('whatsapp_labels')
        .delete()
        .eq('id', labelId);
        // RLS will enforce that only admins can delete any label, and users can delete their own

      if (error) throw error;
      showSuccess("Label deleted successfully!");
      fetchLabels(); // Re-fetch locally
      onLabelsUpdated(); // Notify parent
    } catch (error: any) {
      console.error("Error deleting label:", error.message);
      showError(`Failed to delete label: ${error.message}`);
    }
  };

  const handleAssignLabelClick = (label: LabelItem) => {
    setLabelToAssign(label);
    setIsAssignLabelDialogOpen(true);
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Existing Labels</h3>
        <Button variant="ghost" size="icon" onClick={fetchLabels} title="Refresh Labels">
          <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center text-gray-500">Loading labels...</div>
      ) : labels.length === 0 ? (
        <p className="text-sm text-gray-500">No labels created yet. Add one using the button above.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
              {editingLabel?.id === label.id ? (
                <form onSubmit={handleUpdateLabel} className="flex-1 flex items-center gap-2">
                  <Input
                    value={editingLabel.name}
                    onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                    className="flex-1"
                    required
                  />
                  <Input
                    type="color"
                    value={editingLabel.color}
                    onChange={(e) => setEditingLabel({ ...editingLabel, color: e.target.value })}
                    className="w-10 h-8 p-0 border-none"
                  />
                  <Button type="submit" size="sm" disabled={isLoading}>Save</Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditingLabel(null)}>
                    <XCircle className="h-4 w-4 text-gray-500" />
                  </Button>
                </form>
              ) : (
                <>
                  <div className="flex flex-col">
                    <LabelBadge name={label.name} color={label.color} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Owner: {label.user_email || `User ID: ${label.user_id}`}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    {userRole === 'admin' && ( // Only admins can assign
                      <Button variant="ghost" size="icon" onClick={() => handleAssignLabelClick(label)} title="Assign Label to User">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditingLabel(label)} title="Edit Label">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete Label">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the label "{label.name}" and remove it from all conversations.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteLabel(label.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {labelToAssign && (
        <AssignLabelToUserDialog
          isOpen={isAssignLabelDialogOpen}
          onOpenChange={setIsAssignLabelDialogOpen}
          label={labelToAssign}
          onLabelAssigned={() => {
            fetchLabels(); // Refresh the list after assignment
            onLabelsUpdated();
          }}
        />
      )}
    </div>
  );
};

export default LabelListAndActions;