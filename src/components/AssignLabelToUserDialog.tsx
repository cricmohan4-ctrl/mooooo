"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';

interface LabelItem {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

interface UserDetail {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface AssignLabelToUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  label: LabelItem;
  onLabelAssigned: () => void;
}

const AssignLabelToUserDialog: React.FC<AssignLabelToUserDialogProps> = ({
  isOpen,
  onOpenChange,
  label,
  onLabelAssigned,
}) => {
  const { user: currentUser } = useSession();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(label.user_id);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      try {
        const { data, error } = await supabase
          .from('user_details') // Assuming user_details view is available
          .select('id, email, first_name, last_name')
          .order('email', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
      } catch (error: any) {
        console.error("Error fetching users for assignment:", error.message);
        showError("Failed to load users for assignment.");
      }
    };

    if (isOpen && currentUser) {
      fetchUsers();
      setSelectedUserId(label.user_id); // Reset selected user when dialog opens
    }
  }, [isOpen, currentUser, label.user_id]);

  const handleAssignLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showError("You must be logged in to assign labels.");
      return;
    }
    if (!selectedUserId) {
      showError("Please select a user to assign the label to.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_labels')
        .update({ user_id: selectedUserId })
        .eq('id', label.id);

      if (error) throw error;

      showSuccess(`Label "${label.name}" assigned successfully!`);
      onOpenChange(false);
      onLabelAssigned();
    } catch (error: any) {
      console.error("Error assigning label:", error.message);
      showError(`Failed to assign label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Label: "{label.name}"</DialogTitle>
          <DialogDescription>
            Select a user to assign ownership of this label.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAssignLabel}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignUser" className="text-right">
                Assign To
              </Label>
              <Select onValueChange={setSelectedUserId} value={selectedUserId} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name && u.last_name ? `${u.first_name} ${u.last_name} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Assigning..." : "Assign Label"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AssignLabelToUserDialog;