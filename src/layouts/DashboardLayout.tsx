"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean; // New prop to conditionally hide the header
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, hideHeader }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Overlay for mobile sidebar */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <div className={cn(
        "flex flex-col flex-1 transition-all duration-300 ease-in-out",
        { "lg:ml-64": !isMobile || !isSidebarOpen } // Adjust margin for desktop sidebar
      )}>
        {/* Header - Conditionally rendered */}
        {!hideHeader && <Header onMenuClick={toggleSidebar} />}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          2025 © Meghi
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;