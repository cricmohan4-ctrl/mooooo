"use client";

import React, { useEffect, useState } from 'react';
import { Menu, Bell, UserCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useSession();
  const navigate = useNavigate(); // Initialize useNavigate
  const [userRole, setUserRole] = useState<string | null>(null);
  const userEmail = user?.email || 'Guest';
  const userInitials = userEmail.charAt(0).toUpperCase();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error) throw error;
          setUserRole(data?.role || 'user');
        } catch (error: any) {
          console.error("Error fetching user role for header:", error.message);
          setUserRole('user'); // Default to user role on error
        }
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login'); // Redirect to login page after logout
  };

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
          {userRole && (
            <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full flex items-center">
              <span className="font-medium">Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
            </div>
          )}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url || "https://github.com/shadcn.png"} alt={userEmail} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.user_metadata?.first_name || userEmail}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;