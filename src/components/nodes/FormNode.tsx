"use client";

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface FormNodeData {
  formName: string;
  formId: string;
}

const FormNode = ({ data }: { data: FormNodeData }) => {
  return (
    <Card className="w-60 shadow-md border-orange-500 border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 bg-orange-50 dark:bg-orange-900 rounded-t-md">
        <CardTitle className="text-sm font-medium flex items-center text-orange-800 dark:text-orange-200">
          <FileText className="h-4 w-4 mr-2" /> Send Form
        </CardTitle>
        <Handle type="target" position={Position.Top} className="w-2 h-2 bg-orange-500" />
      </CardHeader>
      <CardContent className="p-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="whitespace-pre-wrap">Form: "{data.formName || "Select a Form"}"</p>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-orange-500" />
    </Card>
  );
};

export default memo(FormNode);