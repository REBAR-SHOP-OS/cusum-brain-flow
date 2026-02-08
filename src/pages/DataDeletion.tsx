import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

export default function DataDeletion() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold">User Data Deletion</h1>
        <p className="text-muted-foreground">
          Last updated: February 8, 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">How to Request Data Deletion</h2>
            <p>
              If you would like to request the deletion of your data associated with our Facebook or Instagram integration, you can do so by following the steps below:
            </p>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Send an email to <a href="mailto:sattar@rebar.shop" className="text-primary underline">sattar@rebar.shop</a> with the subject line <strong>"Data Deletion Request"</strong>.</li>
              <li>Include your Facebook or Instagram account name or email associated with your account.</li>
              <li>We will process your request within 30 days and confirm deletion via email.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What Data We Store</h2>
            <p>When you connect your Facebook or Instagram account, we store:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Your profile name</li>
              <li>Page access tokens (encrypted)</li>
              <li>List of connected pages</li>
              <li>Instagram business account identifiers</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What Happens When You Request Deletion</h2>
            <p>Upon receiving your request, we will:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Remove all stored access tokens</li>
              <li>Delete your integration connection records</li>
              <li>Remove any cached page or account information</li>
            </ul>
            <p>
              You can also disconnect your account at any time from the <strong>Integrations</strong> page within the application, which immediately removes all stored tokens and connection data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Contact Us</h2>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href="mailto:sattar@rebar.shop" className="text-primary underline">sattar@rebar.shop</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
