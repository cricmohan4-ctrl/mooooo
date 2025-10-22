"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Tag, Tags } from 'lucide-react'; // Added Tags icon
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import LabelBadge from './LabelBadge';

interface LabelItem {
  id: string;
  name: string;
  color: string;
  applied_by_user_id?: string; // Added optional applied_by_user_id
}

interface ApplyLabelsPopoverProps {
  conversationId: string;
  currentLabels: (LabelItem & { applied_by_user_id: string })[]; // Explicitly include applied_by_user_id
  onLabelsApplied: () => void; // Callback to refresh parent
}

const ApplyLabelsPopover: React.FC<ApplyLabelsPopoverProps> = ({
  conversationId,
  currentLabels,
  onLabelsApplied,
}) => {
  const { user } = useSession();
  const [allLabels, setAllLabels] = useState<LabelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchAllLabels = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setAllLabels(data || []);
    } catch (error: any) {
      console.error("Error fetching all labels:", error.message);
      showError("Failed to load labels.");
    }
  }, [user]);

  useEffect(() => {
    if (user && isOpen) {
      fetchAllLabels();
    }
  }, [user, isOpen, fetchAllLabels]);

  const getAppliedLabel = (labelId: string) => {
    return currentLabels.find(label => label.id === labelId);
  };

  const handleToggleLabel = async (label: LabelItem) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const appliedLabel = getAppliedLabel(label.id);

      if (appliedLabel) {
        // Attempting to remove label
        if (appliedLabel.applied_by_user_id !== user.id) {
          showError("You can only remove labels you have applied.");
          setIsLoading(false);
          return;
        }
        const { error } = await supabase
          .from('whatsapp_conversation_labels')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('label_id', label.id)
          .eq('user_id', user.id); // Ensure only own labels are deleted

        if (error) throw error;
        showSuccess(`Label "${label.name}" removed.`);
      } else {
        // Attempting to add label
        const { error } = await supabase
          .from('whatsapp_conversation_labels')
          .insert({
            conversation_id: conversationId,
            label_id: label.id,
            user_id: user.id, // Explicitly set user_id on insert
          });

        if (error) throw error;
        showSuccess(`Label "${label.name}" applied.`);
      }
      onLabelsApplied(); // Refresh parent component's labels
    } catch (error: any) {
      console.error("Error toggling label:", error.message);
      showError(`Failed to update label: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Apply Labels">
          <Tags className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="mb-2">
          <h4 className="font-semibold text-sm">Apply Labels</h4>
          <p className="text-xs text-gray-500">Select labels for this conversation.</p>
        </div>
        {allLabels.length === 0 ? (
          <p className="text-sm text-gray-500">No labels available. Create some in "Manage Labels".</p>
        ) : (
          <div className="space-y-1">
            {allLabels.map((label) => {
              const appliedLabel = getAppliedLabel(label.id);
              const isApplied = !!appliedLabel;
              const canRemove = isApplied && appliedLabel.applied_by_user_id === user?.id;

              return (
                <Button
                  key={label.id}
                  variant="ghost"
                  className="w-full justify-between text-sm h-auto py-1.5"
                  onClick={() => handleToggleLabel(label)}
                  disabled={isLoading || (isApplied && !canRemove)} // Disable if applied by another user
                >
                  <div className="flex items-center">
                    <LabelBadge name={label.name} color={label.color} className="mr-2" />
                  </div>
                  {isApplied && <Check className="h-4 w-4 text-green-500" />}
                </Button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ApplyLabelsPopover;