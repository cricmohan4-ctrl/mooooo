"use client";

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ButtonConfig {
  text: string;
  payload: string;
}

interface ButtonMessageNodeData {
  message: string;
  buttons: ButtonConfig[];
}

const ButtonMessageNode = ({ data }: { data: ButtonMessageNodeData }) => {
  return (
    <Card className="w-60 shadow-md border-purple-500 border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 bg-purple-50 dark:bg-purple-900 rounded-t-md">
        <CardTitle className="text-sm font-medium flex items-center text-purple-800 dark:text-purple-200">
          <MessageCircle className="h-4 w-4 mr-2" /> Message with Buttons
        </CardTitle>
        <Handle type="target" position={Position.Top} className="w-2 h-2 bg-purple-500" />
      </CardHeader>
      <CardContent className="p-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="whitespace-pre-wrap mb-2">{data.message || "No message set."}</p>
        {data.buttons && data.buttons.length > 0 && (
          <div className="space-y-1">
            {data.buttons.map((button, index) => (
              <Button key={index} variant="outline" size="sm" className="w-full justify-start text-xs h-auto py-1">
                <MousePointerClick className="h-3 w-3 mr-1" /> {button.text}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-purple-500" />
    </Card>
  );
};

export default memo(ButtonMessageNode);