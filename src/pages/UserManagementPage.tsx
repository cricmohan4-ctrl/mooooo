"use client";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, RefreshCw, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError, showSuccess } from "@/utils/toast";
import AddUserDialog from '@/components/AddUserDialog';
import EditUserDialog from '@/components/EditUserDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserDetail {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  auth_created_at: string;
  profile_updated_at: string;
  role: 'user' | 'admin'; // Added role
}

const UserManagementPage = () => {
  const { user, isAdmin, session } = useSession();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<UserDetail | null>(null);

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

  const handleDeleteUser = async (userIdToDelete: string) => {
    if (!session) {
      showError("You must be logged in to delete a user.");
      return;
    }
    if (userIdToDelete === user?.id) {
      showError("You cannot delete your own account.");
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: userIdToDelete },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (invokeError) {
        console.error("Supabase Function Invoke Error:", invokeError.message);
        showError(`Failed to delete user: ${invokeError.message}`);
        return;
      }

      if (data.error) {
        console.error("Edge Function returned error status:", data.error);
        showError(`Failed to delete user: ${data.error}`);
        return;
      }

      showSuccess("User deleted successfully!");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error.message);
      showError(`Failed to delete user: ${error.message}`);
    }
  };

  const handleEditUserClick = (user: UserDetail) => {
    setSelectedUserToEdit(user);
    setIsEditUserDialogOpen(true);
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
          {isAdmin && (
            <Button variant="outline" size="icon" title="Add New User" onClick={() => setIsAddUserDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" />
            </Button>
          )}
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
                        Role: <span className="font-semibold">{u.role}</span> | Joined: {new Date(u.auth_created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" title="Edit User" onClick={() => handleEditUserClick(u)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Delete User" disabled={u.id === user?.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the user "{u.email}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddUserDialog
        isOpen={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onUserAdded={fetchUsers}
      />

      {selectedUserToEdit && (
        <EditUserDialog
          isOpen={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
          userToEdit={selectedUserToEdit}
          onUserUpdated={fetchUsers}
        />
      )}
    </div>
  );
};

export default UserManagementPage;