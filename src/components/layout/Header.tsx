"use client";

import React from 'react';
import { Menu, Bell, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/integrations/supabase/auth';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useSession();
  const userEmail = user?.email || 'Guest';
  const userInitials = userEmail.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-brand-green text-brand-green-foreground shadow-md z-40">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden text-white">
          <Menu className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-semibold ml-4 hidden lg:block">Dashboard</h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm">
          <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full flex items-center">
            <span className="font-medium">Subscriber</span>
            <span className="ml-1">0/00</span>
          </div>
          <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full flex items-center">
            <span className="font-medium">Message</span>
            <span className="ml-1">0/1.0K</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-white">
          <Bell className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.user_metadata?.avatar_url || "https://github.com/shadcn.png"} alt={userEmail} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};

export default Header;