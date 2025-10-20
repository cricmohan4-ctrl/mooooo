"use client";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Bot, Trash2, Edit } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const FlowsPage = () => {
  const { user } = useSession();
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [isAddFlowDialogOpen, setIsAddFlowDialogOpen] = useState(false);
  const [isAddingFlow, setIsAddingFlow] = useState(false);

  const fetchFlows = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("id, name, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFlows(data || []);
    } catch (error: any) {
      console.error("Error fetching chatbot flows:", error.message);
      showError("Failed to load chatbot flows.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to create a flow.");
      return;
    }
    if (!newFlowName.trim()) {
      showError("Flow name cannot be empty.");
      return;
    }

    setIsAddingFlow(true);
    try {
      const initialFlowData = {
        nodes: [
          {
            id: 'start-node',
            type: 'input',
            data: { label: 'Start Flow' },
            position: { x: 250, y: 5 },
          },
        ],
        edges: [],
      };

      const { error } = await supabase
        .from("chatbot_flows")
        .insert({
          user_id: user.id,
          name: newFlowName.trim(),
          description: newFlowDescription.trim() || null,
          flow_data: initialFlowData,
        });

      if (error) throw error;

      showSuccess("Chatbot flow created successfully!");
      setNewFlowName("");
      setNewFlowDescription("");
      setIsAddFlowDialogOpen(false);
      fetchFlows();
    } catch (error: any) {
      console.error("Error creating chatbot flow:", error.message);
      showError(`Failed to create flow: ${error.message}`);
    } finally {
      setIsAddingFlow(false);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    try {
      const { error } = await supabase
        .from("chatbot_flows")
        .delete()
        .eq("id", flowId)
        .eq("user_id", user?.id);

      if (error) throw error;

      showSuccess("Chatbot flow deleted successfully!");
      fetchFlows();
    } catch (error: any) {
      console.error("Error deleting chatbot flow:", error.message);
      showError(`Failed to delete flow: ${error.message}`);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFlows();
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold ml-4">Chatbot Flows</h1>
        </div>
        <Dialog open={isAddFlowDialogOpen} onOpenChange={setIsAddFlowDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <PlusCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Flow</DialogTitle>
              <DialogDescription>
                Give your new chatbot flow a name and an optional description.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFlow}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="flowName" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="flowName"
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Welcome Message Flow"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="flowDescription" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="flowDescription"
                    value={newFlowDescription}
                    onChange={(e) => setNewFlowDescription(e.target.value)}
                    className="col-span-3"
                    placeholder="Optional description for your flow"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isAddingFlow}>
                  {isAddingFlow ? "Creating..." : "Create Flow"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-500">Loading flows...</div>
        ) : flows.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-500">
            No chatbot flows created yet. Click the '+' button to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow) => (
              <Card key={flow.id} className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{flow.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Link to={`/flows/edit/${flow.id}`}>
                      <Button variant="ghost" size="icon" title="Edit Flow">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete Flow">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the "{flow.name}" chatbot flow.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteFlow(flow.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {flow.description || "No description provided."}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Created: {new Date(flow.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowsPage;