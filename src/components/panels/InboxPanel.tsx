import { useState } from "react";
import { X, Bell, CheckSquare, Lightbulb, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface InboxPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  title: string;
  agent: string;
  agentColor: string;
  type: "complete" | "info";
}

interface TodoItem {
  id: string;
  title: string;
  subtitle: string;
  agent: string;
  agentColor: string;
  count?: number;
}

interface Idea {
  id: string;
  agent: string;
  agentColor: string;
  title: string;
  description: string;
  expiry: string;
}

const mockNotifications: Notification[] = [
  { id: "1", title: "Confirm Consulting Vendor...", agent: "Cal", agentColor: "bg-sky-500", type: "complete" },
];

const mockTodos: TodoItem[] = [
  { id: "1", title: "10 new questions", subtitle: "Brain AI", agent: "Brain", agentColor: "bg-purple-500", count: 10 },
  { id: "2", title: "Review 1 comment", subtitle: "Facebook Commenter", agent: "Soshie", agentColor: "bg-pink-500" },
  { id: "3", title: "Review 13 posts", subtitle: "Social Media Manager", agent: "Rex", agentColor: "bg-teal-500", count: 13 },
  { id: "4", title: "Review 1 email", subtitle: "Inbox Manager", agent: "Ally", agentColor: "bg-orange-500" },
];

const mockIdeas: Idea[] = [
  { 
    id: "1", 
    agent: "Soshie", 
    agentColor: "bg-pink-500", 
    title: "Soshie has an idea", 
    description: "I can create time-lapse content of your fabrication processes", 
    expiry: "Expiring soon" 
  },
  { 
    id: "2", 
    agent: "Rex", 
    agentColor: "bg-teal-500", 
    title: "Rex has an idea", 
    description: "I'll develop joint venture opportunities with concrete suppliers", 
    expiry: "Expiring soon" 
  },
  { 
    id: "3", 
    agent: "Ally", 
    agentColor: "bg-orange-500", 
    title: "Ally has an idea", 
    description: "I'll create warranty claim protocols for fabricated products", 
    expiry: "Expiring soon" 
  },
];

export function InboxPanel({ isOpen, onClose }: InboxPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-16 w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Notifications */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Notifications</h3>
              <button className="text-xs text-muted-foreground hover:text-foreground">Dismiss all</button>
            </div>
            <div className="space-y-2">
              {mockNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium", notification.agentColor)}>
                    {notification.agent[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.agent} · Task complete</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* To-do */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">To-do</h3>
            <div className="space-y-2">
              {mockTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium", todo.agentColor)}>
                    {todo.agent[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{todo.title}</p>
                    <p className="text-xs text-muted-foreground">{todo.subtitle}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </section>

          {/* Ideas */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Ideas</h3>
            <div className="space-y-2">
              {mockIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0", idea.agentColor)}>
                    {idea.agent[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{idea.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{idea.description}</p>
                    <p className="text-xs text-warning mt-1">{idea.expiry}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
