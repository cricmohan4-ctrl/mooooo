"use client";

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Plug,
  Bot,
  Users,
  Menu,
  Tag, // Import Tag icon for Label Management
  FileText, // Import FileText icon for Form Builder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/integrations/supabase/auth'; // Import useSession
import { supabase } from '@/integrations/supabase/client'; // Import supabase client

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const allNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['user', 'admin'] },
  { name: 'Shared Inbox', href: '/inbox', icon: Inbox, roles: ['user', 'admin'] },
  { name: 'Connect Account', href: '/connect-account', icon: Plug, roles: ['admin'] },
  { name: 'Chatbot Rules', href: '/chatbot-rules', icon: Bot, roles: ['admin'] },
  { name: 'Form Builder', href: '/form-builder', icon: FileText, roles: ['admin'] }, // New item
  { name: 'Label Management', href: '/label-management', icon: Tag, roles: ['admin'] },
  { name: 'User Management', href: '/user-management', icon: Users, roles: ['admin'] },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user: currentUser } = useSession(); // Get current user from session
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

          if (error) throw error;
          setUserRole(data?.role || 'user'); // Default to 'user' if role is null
        } catch (error: any) {
          console.error("Error fetching user role for sidebar:", error.message);
          setUserRole('user'); // Default to 'user' role on error
        }
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [currentUser]);

  const filteredNavItems = allNavItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

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
          {filteredNavItems.map((item) => (
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
      </nav>
    </aside>
  );
};

export default Sidebar;