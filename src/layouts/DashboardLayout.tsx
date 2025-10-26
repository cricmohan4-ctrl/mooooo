"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom'; // Import Link for footer navigation

interface DashboardLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean; // New prop to hide the footer
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, hideHeader, hideFooter }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900"> {/* Changed min-h-screen to h-screen */}
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
        <main className="flex-1 overflow-hidden"> {/* Added overflow-hidden here */}
          {children}
        </main>

        {/* Footer - Conditionally rendered */}
        {!hideFooter && (
          <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex justify-center space-x-4">
            <Link to="/terms-and-conditions" className="hover:underline">Terms and Conditions</Link>
            <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <Link to="/data-deletion-instructions" className="hover:underline">Data Deletion Instructions</Link> {/* New link */}
            <span>2025 © Meghi</span>
          </footer>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;