"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Tag } from 'lucide-react';
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
  const [labelsAppliedToAllSelected, setLabelsAppliedToAllSelected] = useState<string[]>([]);

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

  const checkLabelsAppliedToAllSelected = useCallback(async () => {
    if (!user || conversationIds.length === 0) {
      setLabelsAppliedToAllSelected([]);
      return;
    }

    try {
      const { data: conversationLabels, error } = await supabase
        .from('whatsapp_conversation_labels')
        .select('conversation_id, label_id')
        .in('conversation_id', conversationIds);

      if (error) throw error;

      const labelCounts: { [labelId: string]: number } = {};
      conversationLabels.forEach(cl => {
        labelCounts[cl.label_id] = (labelCounts[cl.label_id] || 0) + 1;
      });

      const labelsFullyApplied = Object.keys(labelCounts).filter(
        labelId => labelCounts[labelId] === conversationIds.length
      );
      setLabelsAppliedToAllSelected(labelsFullyApplied);

    } catch (error: any) {
      console.error("Error checking labels for selected conversations:", error.message);
      showError("Failed to check applied labels.");
    }
  }, [user, conversationIds]);

  useEffect(() => {
    if (user && isOpen) {
      fetchAllLabels();
      checkLabelsAppliedToAllSelected();
    }
  }, [user, isOpen, fetchAllLabels, checkLabelsAppliedToAllSelected]);

  useEffect(() => {
    // Re-check labels if conversationIds change while popover is open
    if (isOpen) {
      checkLabelsAppliedToAllSelected();
    }
  }, [conversationIds, isOpen, checkLabelsAppliedToAllSelected]);


  const handleToggleLabel = async (label: LabelItem) => {
    if (!user || conversationIds.length === 0) return;
    setIsLoading(true);

    const isCurrentlyAppliedToAll = labelsAppliedToAllSelected.includes(label.id);
    const operations: Promise<any>[] = [];

    try {
      for (const convId of conversationIds) {
        if (isCurrentlyAppliedToAll) {
          // Remove label from all selected conversations
          operations.push(
            supabase
              .from('whatsapp_conversation_labels')
              .delete()
              .eq('conversation_id', convId)
              .eq('label_id', label.id)
          );
        } else {
          // Add label to all selected conversations (upsert to avoid duplicates)
          operations.push(
            supabase
              .from('whatsapp_conversation_labels')
              .upsert(
                { conversation_id: convId, label_id: label.id },
                { onConflict: 'conversation_id,label_id', ignoreDuplicates: true }
              )
          );
        }
      }

      const results = await Promise.all(operations);
      const hasErrors = results.some(res => res.error);

      if (hasErrors) {
        console.error("Errors during bulk label update:", results.filter(res => res.error));
        showError(`Failed to ${isCurrentlyAppliedToAll ? 'remove' : 'apply'} some labels.`);
      } else {
        showSuccess(`Label "${label.name}" ${isCurrentlyAppliedToAll ? 'removed from' : 'applied to'} ${conversationIds.length} conversations.`);
        onLabelsApplied(); // Refresh parent component's labels
        checkLabelsAppliedToAllSelected(); // Re-check state after update
      }
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
        <Button variant="outline" size="sm" disabled={isLoading || conversationIds.length === 0}>
          <Tag className="h-4 w-4 mr-2" /> Apply Labels ({conversationIds.length})
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
                {labelsAppliedToAllSelected.includes(label.id) && <Check className="h-4 w-4 text-green-500" />}
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