"use client";

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText } from 'lucide-react'; // Changed from MessageSquareIncoming

interface IncomingMessageNodeData {
  expectedMessage: string;
}

const IncomingMessageNode = ({ data }: { data: IncomingMessageNodeData }) => {
  return (
    <Card className="w-60 shadow-md border-green-500 border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 bg-green-50 dark:bg-green-900 rounded-t-md">
        <CardTitle className="text-sm font-medium flex items-center text-green-800 dark:text-green-200">
          <MessageSquareText className="h-4 w-4 mr-2" /> Incoming Message
        </CardTitle>
        <Handle type="target" position={Position.Top} className="w-2 h-2 bg-green-500" />
      </CardHeader>
      <CardContent className="p-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="whitespace-pre-wrap">Expected: "{data.expectedMessage || "Any message"}"</p>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-green-500" />
    </Card>
  );
};

export default memo(IncomingMessageNode);