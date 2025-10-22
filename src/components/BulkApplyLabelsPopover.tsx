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
import LabelBadge from './LabelBadge';
import { Separator } from '@/components/ui/separator';

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

// New interface for conversation labels with user_id
interface ConversationLabel {
  conversation_id: string;
  label_id: string;
  user_id: string;
}

interface BulkApplyLabelsPopoverProps {
  conversationIds: string[]; // IDs of selected conversations
  onLabelsApplied: () => void; // Callback to refresh parent
}

const BulkApplyLabelsPopover: React.FC<BulkApplyLabelsPopoverProps> = ({
  conversationIds,
  onLabelsApplied,
}) => {
  const { user } = useSession();
  const [allLabels, setAllLabels] = useState<LabelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [allConversationLabels, setAllConversationLabels] = useState<ConversationLabel[]>([]); // Store all labels for selected conversations

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

  const fetchConversationLabels = useCallback(async () => {
    if (!user || conversationIds.length === 0) {
      setAllConversationLabels([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversation_labels')
        .select('conversation_id, label_id, user_id') // Fetch user_id
        .in('conversation_id', conversationIds);

      if (error) throw error;
      setAllConversationLabels(data || []);
    } catch (error: any) {
      console.error("Error fetching conversation labels for bulk action:", error.message);
      showError("Failed to load applied labels.");
    }
  }, [user, conversationIds]);

  useEffect(() => {
    if (user && isOpen) {
      fetchAllLabels();
      fetchConversationLabels();
    }
  }, [user, isOpen, fetchAllLabels, fetchConversationLabels]);

  useEffect(() => {
    // Re-fetch conversation labels if conversationIds change while popover is open
    if (isOpen) {
      fetchConversationLabels();
    }
  }, [conversationIds, isOpen, fetchConversationLabels]);

  const isLabelAppliedToAllSelected = (labelId: string) => {
    if (conversationIds.length === 0) return false;
    return conversationIds.every(convId =>
      allConversationLabels.some(cl => cl.conversation_id === convId && cl.label_id === labelId)
    );
  };

  const handleToggleLabel = async (label: LabelItem) => {
    if (!user || conversationIds.length === 0) return;
    setIsLoading(true);

    const operations: Promise<any>[] = [];
    const isCurrentlyApplied = isLabelAppliedToAllSelected(label.id); // Check if applied to ALL selected

    try {
      if (isCurrentlyApplied) {
        // Attempting to remove label from selected conversations
        let removedCount = 0;
        for (const convId of conversationIds) {
          // Find the specific entry for this conversation and label, applied by the current user
          const entryToRemove = allConversationLabels.find(
            cl => cl.conversation_id === convId && cl.label_id === label.id && cl.user_id === user.id
          );

          if (entryToRemove) {
            operations.push(
              supabase
                .from('whatsapp_conversation_labels')
                .delete()
                .eq('conversation_id', convId)
                .eq('label_id', label.id)
                .eq('user_id', user.id) // Crucial for RLS and user-specific deletion
                .then(res => {
                  if (!res.error) removedCount++;
                  return res;
                })
            );
          } else {
            // If the label is applied by another user, or not applied at all by current user, skip deletion for this conv
            console.log(`Skipping deletion of label ${label.name} from conversation ${convId}: not applied by current user or not found.`);
          }
        }
        
        if (operations.length > 0) {
          const results = await Promise.all(operations);
          const hasErrors = results.some(res => res.error);

          if (hasErrors) {
            console.error("Errors during bulk label removal:", results.filter(res => res.error));
            showError(`Failed to remove some labels. You can only remove labels you applied.`);
          } else {
            showSuccess(`Label "${label.name}" removed from ${removedCount} conversations.`);
          }
        } else {
          showError(`Label "${label.name}" is not applied by you to any of the selected conversations.`);
        }

      } else {
        // Attempting to add label to selected conversations
        let addedCount = 0;
        for (const convId of conversationIds) {
          // Check if the label is already applied by *any* user to this conversation
          const isAlreadyAppliedToThisConv = allConversationLabels.some(
            cl => cl.conversation_id === convId && cl.label_id === label.id
          );

          if (!isAlreadyAppliedToThisConv) {
            operations.push(
              supabase
                .from('whatsapp_conversation_labels')
                .insert({ conversation_id: convId, label_id: label.id, user_id: user.id }) // Explicitly set user_id
                .then(res => {
                  if (!res.error) addedCount++;
                  return res;
                })
            );
          }
        }

        if (operations.length > 0) {
          const results = await Promise.all(operations);
          const hasErrors = results.some(res => res.error);

          if (hasErrors) {
            console.error("Errors during bulk label application:", results.filter(res => res.error));
            showError(`Failed to apply some labels.`);
          } else {
            showSuccess(`Label "${label.name}" applied to ${addedCount} conversations.`);
          }
        } else {
          showSuccess(`Label "${label.name}" is already applied to all selected conversations.`);
        }
      }
      onLabelsApplied(); // Refresh parent component's labels
      fetchConversationLabels(); // Re-fetch to update internal state
    } catch (error: any) {
      console.error("Error during bulk label operation:", error.message);
      showError(`Failed to update labels: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" disabled={isLoading || conversationIds.length === 0} title={`Apply Labels (${conversationIds.length})`}>
          <Tags className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="mb-2">
          <h4 className="font-semibold text-sm">Apply Labels</h4>
          <p className="text-xs text-gray-500">Select labels to apply/remove.</p>
        </div>
        {allLabels.length === 0 ? (
          <p className="text-sm text-gray-500">No labels available. Create some in "Manage Labels".</p>
        ) : (
          <div className="space-y-1">
            {allLabels.map((label) => (
              <Button
                key={label.id}
                variant="ghost"
                className="w-full justify-between text-sm h-auto py-1.5"
                onClick={() => handleToggleLabel(label)}
                disabled={isLoading}
              >
                <div className="flex items-center">
                  <LabelBadge name={label.name} color={label.color} className="mr-2" />
                </div>
                {isLabelAppliedToAllSelected(label.id) && <Check className="h-4 w-4 text-green-500" />}
              </Button>
            ))}
          </div>
        )}
        <Separator className="my-2" />
        <p className="text-xs text-gray-500">
          <Check className="inline-block h-3 w-3 mr-1" /> indicates label is applied to ALL selected.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default BulkApplyLabelsPopover;