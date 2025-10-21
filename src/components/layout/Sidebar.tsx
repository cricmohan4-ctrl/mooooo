"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Plug,
  Bot,
  Users,
  Radio,
  MessageSquare,
  Workflow,
  ShoppingCart,
  Settings,
  UserCog,
  UserPlus,
  ReceiptText,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Shared Inbox', href: '/inbox', icon: Inbox },
  { name: 'Connect Account', href: '/connect-account', icon: Plug },
  { name: 'Chatbot Rules', href: '/chatbot-rules', icon: Bot }, // Updated href to new page
];

const controlPanelItems = [
  // All items removed as per user request
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const isMobile = useIsMobile();

  const sidebarClasses = cn(
    "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out",
    {
      "translate-x-0": isOpen,
      "-translate-x-full": !isOpen,
      "lg:translate-x-0 lg:static": !isMobile, // Always visible on desktop
    }
  );

  return (
    <aside className={sidebarClasses}>
      <div className="flex items-center justify-between p-4 h-16 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center space-x-2 text-lg font-bold text-brand-green-foreground">
          <Bot className="h-6 w-6 text-brand-green" />
          <span className="text-gray-900 dark:text-gray-100">Meghi</span>
        </Link>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center p-2 rounded-md text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location.pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                )}
                onClick={isMobile ? onClose : undefined}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        {/* Removed Control Panel section as it is now empty */}
      </nav>
    </aside>
  );
};

export default Sidebar;