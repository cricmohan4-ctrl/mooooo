"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const DataDeletionInstructions = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold ml-4">Data Deletion Instructions</h1>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p>
          At Meghi, we respect your right to manage your personal data. If you wish to delete your account and all associated data, please follow the instructions below.
        </p>

        <h2>1. How to Request Data Deletion</h2>
        <p>
          To initiate the data deletion process, please send an email to our support team at <strong>support@meghi.com</strong> with the subject line "Data Deletion Request".
        </p>
        <p>
          In your email, please include the following information:
        </p>
        <ul>
          <li>Your full name</li>
          <li>The email address associated with your Meghi account</li>
          <li>A brief explanation of your request to delete your data</li>
        </ul>

        <h2>2. Verification Process</h2>
        <p>
          For security purposes, we will need to verify your identity before processing your request. Our support team will respond to your email with instructions on how to complete the verification process. This may involve:
        </p>
        <ul>
          <li>Confirming details associated with your account.</li>
          <li>Responding from the registered email address.</li>
        </ul>

        <h2>3. What Data Will Be Deleted?</h2>
        <p>
          Upon successful verification and processing of your request, we will delete all personal data associated with your account, including but not limited to:
        </p>
        <ul>
          <li>Your user profile information (name, email, etc.)</li>
          <li>All connected WhatsApp accounts and their configurations.</li>
          <li>All chatbot rules and flows you have created.</li>
          <li>All conversation labels and quick replies.</li>
          <li>All forms and form submissions.</li>
          <li>All message history within the platform.</li>
        </ul>
        <p>
          Please note that some anonymized or aggregated data may be retained for analytical purposes, but this data will not be linked back to your personal identity.
        </p>

        <h2>4. Processing Time</h2>
        <p>
          We will endeavor to process your data deletion request within 30 days of successful identity verification. You will receive a confirmation email once your data has been successfully deleted.
        </p>

        <h2>5. Irreversibility</h2>
        <p>
          Please be aware that data deletion is irreversible. Once your data is deleted, it cannot be recovered. We recommend backing up any information you wish to retain before submitting a deletion request.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have any questions or concerns regarding your data or the deletion process, please do not hesitate to contact us at <strong>support@meghi.com</strong>.
        </p>
      </div>
    </div>
  );
};

export default DataDeletionInstructions;