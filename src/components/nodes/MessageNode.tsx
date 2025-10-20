"use client";

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';

interface MessageNodeData {
  message: string;
}

const MessageNode = ({ data }: { data: MessageNodeData }) => {
  return (
    <Card className="w-60 shadow-md border-blue-500 border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 bg-blue-50 dark:bg-blue-900 rounded-t-md">
        <CardTitle className="text-sm font-medium flex items-center text-blue-800 dark:text-blue-200">
          <MessageCircle className="h-4 w-4 mr-2" /> Message
        </CardTitle>
        <Handle type="target" position={Position.Top} className="w-2 h-2 bg-blue-500" />
      </CardHeader>
      <CardContent className="p-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="whitespace-pre-wrap">{data.message || "No message set."}</p>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-blue-500" />
    </Card>
  );
};

export default memo(MessageNode);