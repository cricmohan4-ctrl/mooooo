"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface LabelBadgeProps {
  name: string;
  color?: string;
  className?: string;
}

const LabelBadge: React.FC<LabelBadgeProps> = ({ name, color = '#007bff', className }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
};

export default LabelBadge;