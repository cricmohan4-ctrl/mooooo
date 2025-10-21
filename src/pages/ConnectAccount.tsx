"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ConnectAccount = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-4">Connect WhatsApp Account</h1>
      </div>

      <div className="flex-1 flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">Content for connecting WhatsApp accounts has been removed.</p>
      </div>
    </div>
  );
};

export default ConnectAccount;