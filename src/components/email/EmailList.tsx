import { useState, useEffect } from "react";
import { Mail, RefreshCw, Plus, Search, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchGmailMessages, GmailMessage, parseEmailAddress, formatDate } from "@/lib/gmail";
import { ComposeEmail } from "./ComposeEmail";
import { useToast } from "@/hooks/use-toast";

interface EmailListProps {
  onSelectEmail: (email: GmailMessage) => void;
  selectedId?: string;
}

export function EmailList({ onSelectEmail, selectedId }: EmailListProps) {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const { toast } = useToast();

  const loadEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGmailMessages({ maxResults: 30, query: search || undefined });
      setEmails(result.messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load emails";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEmails();
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="font-semibold">Inbox</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={loadEmails} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button size="icon" onClick={() => setShowCompose(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary border-0"
          />
        </form>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && emails.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : error && emails.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={loadEmails}>
              Retry
            </Button>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No emails found
          </div>
        ) : (
          emails.map((email) => {
            const sender = parseEmailAddress(email.from);
            const isSelected = selectedId === email.id;

            return (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={cn(
                  "w-full text-left p-4 border-b border-border transition-colors",
                  "hover:bg-secondary/50",
                  isSelected && "bg-secondary",
                  email.isUnread && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {email.isUnread && (
                    <Circle className="w-2 h-2 mt-2 fill-primary text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className={cn("truncate text-sm", email.isUnread && "font-semibold")}>
                        {sender.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(email.internalDate)}
                      </span>
                    </div>
                    <p className={cn("text-sm truncate", email.isUnread && "font-medium")}>
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeEmail
          onClose={() => setShowCompose(false)}
          onSent={loadEmails}
        />
      )}
    </div>
  );
}
