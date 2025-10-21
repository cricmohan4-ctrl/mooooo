"use client";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, RefreshCw, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError } from "@/utils/toast";

interface UserDetail {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  auth_created_at: string;
  profile_updated_at: string;
}

const UserManagementPage = () => {
  const { user } = useSession();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const fetchUsers = async () => {
    if (!user) return;
    setIsLoadingUsers(true);
    try {
      // Fetch from the new user_details view
      const { data, error } = await supabase
        .from("user_details")
        .select("*")
        .order("auth_created_at", { ascending: false });

      if (error) {
        throw error;
      }
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error.message);
      showError("Failed to load users.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          User Management
        </h1>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" onClick={fetchUsers} title="Refresh Users">
            <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Button>
          {/* For adding new users, you might link to a custom signup form or an admin panel */}
          {/* <Button variant="outline" size="icon" title="Add New User">
            <PlusCircle className="h-4 w-4" />
          </Button> */}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-medium">
            All Registered Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            View and manage registered users in your application.
          </p>
          {isLoadingUsers ? (
            <div className="text-center text-gray-500 dark:text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-500">
              No users found.
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center">
                    <Avatar className="h-9 w-9 mr-3">
                      <AvatarImage src={u.avatar_url || undefined} alt={u.email} />
                      <AvatarFallback>{(u.first_name?.charAt(0) || u.email.charAt(0)).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Joined: {new Date(u.auth_created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {/* Future: Add buttons for editing user roles, deleting users, etc. */}
                  {/* <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" title="Edit User">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete User">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div> */}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagementPage;