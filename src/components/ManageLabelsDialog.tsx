"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, XCircle } from 'lucide-react';
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

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

interface ManageLabelsDialogProps {
  onLabelsUpdated: () => void;
  isOpen: boolean; // Added prop for external control
  onOpenChange: (open: boolean) => void; // Added prop for external control
}

const defaultColors = [
  '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#6c757d', '#17a2b8', '#e83e8c'
];

const ManageLabelsDialog: React.FC<ManageLabelsDialogProps> = ({ onLabelsUpdated, isOpen, onOpenChange }) => {
  const { user } = useSession();
  // const [isOpen, setIsOpen] = useState(false); // Removed internal state
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(defaultColors[0]);
  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLabels = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select('id, name, color')
        // Removed .eq('user_id', user.id) to allow all authenticated users to see all labels
        .order('name', { ascending: true });

      if (error) throw error;
      setLabels(data || []);
    } catch (error: any) {
      console.error("Error fetching labels:", error.message);
      showError("Failed to load labels.");
    }
  };

  useEffect(() => {
    if (user && isOpen) { // Use external isOpen prop
      fetchLabels();
    }
  }, [user, isOpen]); // Depend on isOpen

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to add a label.");
      return;
    }
    if (!newLabelName.trim()) {
      showError("Label name cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_labels')
        .insert({
          user_id: user.id, // Explicitly set user_id
          name: newLabelName.trim(),
          color: newLabelColor,
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          showError("A label with this name already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Label added successfully!");
        setNewLabelName("");
        setNewLabelColor(defaultColors[0]);
        fetchLabels();
        onLabelsUpdated();
      }
    } catch (error: any) {
      console.error("Error adding label:", error.message);
      showError(`Failed to add label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingLabel) return;
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
        // RLS will enforce that only admins can update

      if (error) {
        if (error.code === '23505') { // Unique violation
          showError("A label with this name already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Label updated successfully!");
        setEditingLabel(null);
        fetchLabels();
        onLabelsUpdated();
      }
    } catch (error: any) {
      console.error("Error updating label:", error.message);
      showError(`Failed to update label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('whatsapp_labels')
        .delete()
        .eq('id', labelId);
        // RLS will enforce that only admins can delete

      if (error) throw error;
      showSuccess("Label deleted successfully!");
      fetchLabels();
      onLabelsUpdated();
    } catch (error: any) {
      console.error("Error deleting label:", error.message);
      showError(`Failed to delete label: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}> {/* Use external props here */}
      {/* Removed DialogTrigger as it will be triggered by a button on the LabelManagementPage */}
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Manage Labels</DialogTitle>
          <DialogDescription>
            Create, edit, or delete labels for your conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <h3 className="text-lg font-semibold">Existing Labels</h3>
          {labels.length === 0 ? (
            <p className="text-sm text-gray-500">No labels created yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
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
                      <LabelBadge name={label.name} color={label.color} />
                      <div className="flex space-x-1">
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

          <Separator className="my-4" />

          <h3 className="text-lg font-semibold">Add New Label</h3>
          <form onSubmit={handleAddLabel} className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newLabelName" className="text-right">
                Name
              </Label>
              <Input
                id="newLabelName"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Important, Follow Up"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newLabelColor" className="text-right">
                Color
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="newLabelColor"
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-12 h-8 p-0 border-none"
                />
                <div className="flex flex-wrap gap-1">
                  {defaultColors.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      size="icon"
                      className="h-6 w-6 rounded-full border-2"
                      style={{ backgroundColor: color, borderColor: newLabelColor === color ? 'black' : 'transparent' }}
                      onClick={() => setNewLabelColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Label"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageLabelsDialog;