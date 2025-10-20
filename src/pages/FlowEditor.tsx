"use client";

import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Viewport,
  Node,
  Edge as ReactFlowEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, PlusCircle, MessageCircle, MousePointerClick, XCircle, Trash2, MessageSquareText, MessageSquareHeart, Type, Image } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import MessageNode from '@/components/nodes/MessageNode';
import ButtonMessageNode from '@/components/nodes/ButtonMessageNode';
import IncomingMessageNode from '@/components/nodes/IncomingMessageNode';
import WelcomeMessageNode from '@/components/nodes/WelcomeMessageNode';
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nodeTypes = {
  messageNode: MessageNode,
  buttonMessageNode: ButtonMessageNode,
  incomingMessageNode: IncomingMessageNode,
  welcomeMessageNode: WelcomeMessageNode,
};

interface FlowData {
  nodes: any[];
  edges: any[];
  viewport?: Viewport;
}

interface ButtonConfig {
  text: string;
  payload: string;
}

const FlowEditorContent = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesState] = useEdgesState([]);
  const { fitView, setViewport, getViewport, getNodes, getEdges } = useReactFlow();
  const [flowName, setFlowName] = useState("Loading Flow...");
  const [isSaving, setIsSaving] = useState(false);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [editedButtons, setEditedButtons] = useState<ButtonConfig[]>([]);
  const [editedExpectedInputType, setEditedExpectedInputType] = useState<'text' | 'image' | 'any'>('any');
  const [editedPrompt, setEditedPrompt] = useState("");

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onSave = useCallback(async () => {
    if (!user || !flowId) return;

    setIsSaving(true);
    try {
      const flowData: FlowData = {
        nodes: nodes.map(node => ({ ...node, selected: false })),
        edges: edges.map(edge => ({ ...edge, selected: false })),
        viewport: getViewport(),
      };

      const { error } = await supabase
        .from("chatbot_flows")
        .update({ flow_data: flowData, updated_at: new Date().toISOString() })
        .eq("id", flowId)
        .eq("user_id", user.id);

      if (error) throw error;
      showSuccess("Flow saved successfully!");
    } catch (error: any) {
      console.error("Error saving flow:", error.message);
      showError(`Failed to save flow: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, flowId, user, getViewport]);

  const onRestore = useCallback(async () => {
    if (!user || !flowId) return;

    try {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("name, flow_data")
        .eq("id", flowId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          showError("Flow not found or you don't have permission to access it.");
          navigate('/flows');
          return;
        }
        throw error;
      }

      setFlowName(data.name);
      const flowData: FlowData = data.flow_data as FlowData;

      if (flowData && Array.isArray(flowData.nodes) && Array.isArray(flowData.edges) && flowData.nodes.length > 0) {
        setNodes(flowData.nodes);
        setEdges(flowData.edges);
        if (flowData.viewport) {
          setViewport(flowData.viewport);
        } else {
          requestAnimationFrame(() => {
            fitView();
          });
        }
        showSuccess("Flow loaded successfully!");
      } else {
        // Initialize with Start Flow and Welcome Message nodes if flow data is empty
        const initialNodes = [
          {
            id: 'start-node',
            type: 'input',
            data: { label: 'Start Flow' },
            position: { x: 250, y: 5 },
          },
          {
            id: 'welcome-message-node',
            type: 'welcomeMessageNode',
            data: { label: 'Welcome Message', message: "Hello! Welcome to our service. How can I help you today?" },
            position: { x: 250, y: 150 },
          },
        ];
        const initialEdges = [
          { id: 'e-start-welcome', source: 'start-node', target: 'welcome-message-node', animated: true },
        ];
        setNodes(initialNodes);
        setEdges(initialEdges);
        requestAnimationFrame(() => {
          fitView();
        });
        showSuccess("Loaded flow data is empty or invalid. Starting with a default 'Welcome Message' flow.");
      }
    } catch (error: any) {
      console.error("Error loading flow:", error.message);
      showError(`Failed to load flow: ${error.message}`);
      navigate('/flows');
    }
  }, [flowId, user, setNodes, setEdges, setViewport, fitView, navigate]);

  useEffect(() => {
    if (user && flowId) {
      onRestore();
    }
  }, [user, flowId, onRestore]);

  const addNode = useCallback((type: string) => {
    const baseNode = {
      id: `node_${Date.now()}`,
      type,
      position: { x: Math.random() * 250, y: Math.random() * 250 },
    };

    let newNode;
    switch (type) {
      case 'messageNode':
        newNode = { ...baseNode, data: { label: 'Message', message: "New message content." } };
        break;
      case 'buttonMessageNode':
        newNode = { ...baseNode, data: { label: 'Button Message', message: "New message content.", buttons: [] } };
        break;
      case 'incomingMessageNode':
        newNode = { ...baseNode, data: { label: 'Incoming Message', expectedInputType: 'text', prompt: "Please provide the requested information." } };
        break;
      case 'welcomeMessageNode':
        newNode = { ...baseNode, data: { label: 'Welcome Message', message: "Hello! Welcome to our service." } };
        break;
      default:
        newNode = { ...baseNode, data: { label: 'Unknown Node' } };
    }

    setNodes((nds) => nds.concat(newNode));
    showSuccess(`Added a new ${newNode.data.label} node.`);
  }, [setNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setEditingNode(node);
    setEditedMessage(node.data.message || "");
    setEditedButtons(node.data.buttons ? [...node.data.buttons] : []);
    setEditedExpectedInputType(node.data.expectedInputType || 'any');
    setEditedPrompt(node.data.prompt || "");
    setIsNodeEditorOpen(true);
  }, []);

  const handleSaveNodeChanges = () => {
    if (editingNode) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === editingNode.id) {
            let updatedData = { ...node.data };
            if (node.type === 'messageNode' || node.type === 'buttonMessageNode' || node.type === 'welcomeMessageNode') {
              updatedData = { ...updatedData, message: editedMessage };
            }
            if (node.type === 'buttonMessageNode') {
              updatedData = { ...updatedData, buttons: editedButtons };
            }
            if (node.type === 'incomingMessageNode') {
              updatedData = { ...updatedData, expectedInputType: editedExpectedInputType, prompt: editedPrompt };
            }
            return { ...node, data: updatedData };
          }
          return node;
        }),
      );
      showSuccess("Node updated!");
      setIsNodeEditorOpen(false);
      setEditingNode(null);
    }
  };

  const handleAddButton = () => {
    setEditedButtons([...editedButtons, { text: "", payload: "" }]);
  };

  const handleRemoveButton = (index: number) => {
    setEditedButtons(editedButtons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof ButtonConfig, value: string) => {
    const newButtons = [...editedButtons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setEditedButtons(newButtons);
  };

  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = getNodes().filter(node => node.selected);
    const selectedEdges = getEdges().filter(edge => edge.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      showError("No elements selected to delete.");
      return;
    }

    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
    showSuccess(`Deleted ${selectedNodes.length} nodes and ${selectedEdges.length} edges.`);
  }, [getNodes, getEdges, setNodes, setEdges]);


  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/flows">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold ml-4 text-gray-900 dark:text-gray-100">{flowName}</h1>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleDeleteSelected} variant="outline" title="Delete Selected">
            <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Flow"} <Save className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      <div className="flex flex-1">
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Nodes</h3>
          <div className="space-y-2">
            <Button className="w-full justify-start" variant="outline" onClick={() => addNode('messageNode')}>
              <MessageCircle className="h-4 w-4 mr-2" /> Message Node
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => addNode('buttonMessageNode')}>
              <MousePointerClick className="h-4 w-4 mr-2" /> Button Message Node
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => addNode('incomingMessageNode')}>
              <MessageSquareText className="h-4 w-4 mr-2" /> Incoming Message Node
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => addNode('welcomeMessageNode')}>
              <MessageSquareHeart className="h-4 w-4 mr-2" /> Welcome Message Node
            </Button>
          </div>
        </div>

        <div style={{ height: 'calc(100vh - 65px)', width: 'calc(100% - 256px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesState}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <MiniMap />
            <Controls />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>

      <Dialog open={isNodeEditorOpen} onOpenChange={setIsNodeEditorOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Node: {editingNode?.data?.label}</DialogTitle>
            <DialogDescription>
              Modify the content and properties of this node.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(editingNode?.type === 'messageNode' || editingNode?.type === 'buttonMessageNode' || editingNode?.type === 'welcomeMessageNode') && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nodeMessage" className="text-right">
                  Message
                </Label>
                <Textarea
                  id="nodeMessage"
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  className="col-span-3"
                  rows={3}
                />
              </div>
            )}

            {editingNode?.type === 'incomingMessageNode' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="expectedInputType" className="text-right">
                    Expected Input Type
                  </Label>
                  <Select
                    onValueChange={(value: 'text' | 'image' | 'any') => setEditedExpectedInputType(value)}
                    value={editedExpectedInputType}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select input type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="any">Any (Text or Image)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nodePrompt" className="text-right">
                    Prompt Message
                  </Label>
                  <Textarea
                    id="nodePrompt"
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="col-span-3"
                    placeholder="Message to send if input is not received or incorrect."
                    rows={2}
                  />
                </div>
              </>
            )}

            {editingNode?.type === 'buttonMessageNode' && (
              <>
                <Separator />
                <div className="col-span-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-right">Buttons (Max 3)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddButton} disabled={editedButtons.length >= 3}>
                      Add Button
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editedButtons.map((button, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Button Text"
                          value={button.text}
                          onChange={(e) => handleButtonChange(index, "text", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Payload (triggers next rule)"
                          value={button.payload}
                          onChange={(e) => handleButtonChange(index, "payload", e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveButton(index)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveNodeChanges}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FlowEditor = () => (
  <ReactFlowProvider>
    <FlowEditorContent />
  </ReactFlowProvider>
);

export default FlowEditor;