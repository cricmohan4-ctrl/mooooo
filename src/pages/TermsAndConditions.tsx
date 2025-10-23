"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold ml-4">Terms and Conditions</h1>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p>
          Welcome to Meghi! These terms and conditions outline the rules and regulations for the use of Meghi's Website, located at [Your Website URL].
        </p>
        <p>
          By accessing this website we assume you accept these terms and conditions. Do not continue to use Meghi if you do not agree to take all of the terms and conditions stated on this page.
        </p>

        <h2>1. License</h2>
        <p>
          Unless otherwise stated, Meghi and/or its licensors own the intellectual property rights for all material on Meghi. All intellectual property rights are reserved. You may access this from Meghi for your own personal use subjected to restrictions set in these terms and conditions.
        </p>
        <ul>
          <li>Republish material from Meghi</li>
          <li>Sell, rent or sub-license material from Meghi</li>
          <li>Reproduce, duplicate or copy material from Meghi</li>
          <li>Redistribute content from Meghi</li>
        </ul>

        <h2>2. User Comments</h2>
        <p>
          This Agreement shall begin on the date hereof. Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Meghi does not filter, edit, publish or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Meghi,its agents and/or affiliates. Comments reflect the views and opinions of the person who post their views and opinions. To the extent permitted by applicable laws, Meghi shall not be liable for the Comments or for any liability, damages or expenses caused and/or suffered as a result of any use of and/or posting of and/or appearance of the Comments on this website.
        </p>
        <p>
          Meghi reserves the right to monitor all Comments and to remove any Comments which can be considered inappropriate, offensive or causes breach of these Terms and Conditions.
        </p>

        <h2>3. Disclaimer</h2>
        <p>
          To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website and the use of this website. Nothing in this disclaimer will:
        </p>
        <ul>
          <li>limit or exclude our or your liability for death or personal injury;</li>
          <li>limit or exclude our or your liability for fraud or fraudulent misrepresentation;</li>
          <li>limit any of our or your liabilities in any way that is not permitted under applicable law; or</li>
          <li>exclude any of our or your liabilities that may not be excluded under applicable law.</li>
        </ul>
        <p>
          The limitations and prohibitions of liability set in this Section and elsewhere in this disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities arising under the disclaimer, including liabilities arising in contract, in tort and for breach of statutory duty.
        </p>
        <p>
          As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.
        </p>
      </div>
    </div>
  );
};

export default TermsAndConditions;