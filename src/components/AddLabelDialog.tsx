"use client";

import React, { useState } from 'react';
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
import { PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';

interface AddLabelDialogProps {
  onLabelAdded: () => void;
}

const defaultColors = [
  '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#6c757d', '#17a2b8', '#e83e8c'
];

const AddLabelDialog: React.FC<AddLabelDialogProps> = ({ onLabelAdded }) => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(defaultColors[0]);
  const [isLoading, setIsLoading] = useState(false);

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
        setIsOpen(false);
        onLabelAdded();
      }
    } catch (error: any) {
      console.error("Error adding label:", error.message);
      showError(`Failed to add label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" title="Add New Label">
          <PlusCircle className="h-4 w-4 mr-2" /> Add Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add New Label</DialogTitle>
          <DialogDescription>
            Create a new label for your conversations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddLabel}>
          <div className="grid gap-4 py-4">
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
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Label"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLabelDialog;