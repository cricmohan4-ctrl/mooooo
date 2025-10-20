"use client";

import React from 'react';
import ReactFlow, { Controls, Background, MiniMap } from 'react-flow-renderer';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start Flow' },
    position: { x: 250, y: 5 },
  },
];

const initialEdges = [];

const Flows = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold ml-4 text-gray-900 dark:text-gray-100">Chatbot Flow Builder</h1>
        </div>
        {/* Future: Add buttons for saving, adding nodes, etc. */}
        <Button>Save Flow</Button>
      </div>
      <div style={{ height: 'calc(100vh - 65px)', width: '100%' }}>
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          fitView
          attributionPosition="bottom-left"
        >
          <MiniMap />
          <Controls />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
};

export default Flows;