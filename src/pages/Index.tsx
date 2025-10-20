import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your WhatsApp Automation App</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Manage your WhatsApp accounts and AI integrations here.
        </p>
        <Link to="/dashboard">
          <Button size="lg" className="text-lg px-8 py-4">Go to Dashboard</Button>
        </Link>
      </div>
      <div className="absolute bottom-4">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;