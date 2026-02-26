/**
 * Inbox toolbar — extracted from InboxView.tsx
 * Contains view toggle, compose, fax, SMS, analytics, search, connections, and selection controls.
 */
import { useState, useCallback } from "react";
import {
  RefreshCw, Settings, Loader2, Search, CheckSquare,
  X, Mail, LogOut, Phone, LayoutGrid,
  List, PenSquare, FileText, Volume2, BarChart3, Send, Wifi
} from "lucide-react";
import { InboxAIToolbar, type AIAction } from "./InboxAIToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InboxToolbarProps {
  viewMode: "list" | "kanban";
  setViewMode: (mode: "list" | "kanban") => void;
  onCompose: () => void;
  onFax: () => void;
  onBulkSMS: () => void;
  onCallAnalytics: () => void;
  onEmailAnalytics: () => void;
  emailCount: number;
  unprocessedCount: number;
  onAIAction: (action: AIAction) => Promise<void>;
  search: string;
  setSearch: (s: string) => void;
  showSearch: boolean;
  setShowSearch: (s: boolean) => void;
  selectionMode: boolean;
  toggleSelectMode: () => void;
  syncing: boolean;
  onSync: () => void;
  onSettings: () => void;
  // Connection state
  gmailStatus: "loading" | "connected" | "not_connected";
  gmailEmail: string | null;
  rcStatus: "loading" | "connected" | "not_connected";
  rcEmail: string | null;
  onConnectGmail: () => void;
  onDisconnectGmail: () => void;
  onConnectRC: () => void;
  onDisconnectRC: () => void;
  connecting: boolean;
  rcConnecting: boolean;
}

export function InboxToolbar({
  viewMode, setViewMode, onCompose, onFax, onBulkSMS,
  onCallAnalytics, onEmailAnalytics,
  emailCount, unprocessedCount, onAIAction,
  search, setSearch, showSearch, setShowSearch,
  selectionMode, toggleSelectMode,
  syncing, onSync, onSettings,
  gmailStatus, gmailEmail, rcStatus, rcEmail,
  onConnectGmail, onDisconnectGmail, onConnectRC, onDisconnectRC,
  connecting, rcConnecting,
}: InboxToolbarProps) {
  const gmailConnected = gmailStatus === "connected";
  const rcConnected = rcStatus === "connected";
  const bothLoading = gmailStatus === "loading" && rcStatus === "loading";

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0">
      {/* View toggle */}
      <div className="flex items-center border border-border rounded-md overflow-hidden">
        <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="icon" className="h-6 w-6 rounded-none" onClick={() => setViewMode("kanban")} title="Kanban view">
          <LayoutGrid className="w-3 h-3" />
        </Button>
        <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-6 w-6 rounded-none" onClick={() => setViewMode("list")} title="List view">
          <List className="w-3 h-3" />
        </Button>
      </div>

      {/* Compose */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="default" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={onCompose}>
            <PenSquare className="w-3 h-3" /> Compose
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Compose new email (c)</TooltipContent>
      </Tooltip>

      {/* Fax */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={onFax}>
            <FileText className="w-3 h-3" /> Fax
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Send a fax</TooltipContent>
      </Tooltip>

      {/* Bulk SMS */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={onBulkSMS}>
            <Send className="w-3 h-3" /> SMS
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Bulk SMS</TooltipContent>
      </Tooltip>

      {/* Call Analytics */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={onCallAnalytics}>
            <BarChart3 className="w-3 h-3" /> Call Analytics
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Call Analytics</TooltipContent>
      </Tooltip>

      {/* Email Analytics */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={onEmailAnalytics}>
            <Mail className="w-3 h-3" /> Email Analytics
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Email Analytics</TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border shrink-0" />

      {/* AI actions */}
      <InboxAIToolbar emailCount={emailCount} onAction={onAIAction} unprocessedCount={unprocessedCount} />

      <div className="flex-1" />

      {/* Search */}
      {showSearch ? (
        <div className="relative max-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-6 pl-7 pr-6 text-[11px]" autoFocus onBlur={() => { if (!search) setShowSearch(false); }} />
          {search && (
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setShowSearch(false); }}>
              <X className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
          )}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSearch(true)}>
              <Search className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Search</TooltipContent>
        </Tooltip>
      )}

      {/* Connection status */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
            {bothLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className={cn("w-1.5 h-1.5 rounded-full", gmailConnected ? "bg-emerald-400" : "bg-muted-foreground/40")} />
                <div className={cn("w-1.5 h-1.5 rounded-full", rcConnected ? "bg-blue-400" : "bg-muted-foreground/40")} />
              </>
            )}
            <Wifi className="w-3 h-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2.5 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Connections</p>
          <div className="flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", gmailConnected ? "bg-emerald-500/15" : "bg-muted")}>
              <Mail className={cn("w-3 h-3", gmailConnected ? "text-emerald-400" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium">Gmail</p>
              <p className="text-[9px] text-muted-foreground truncate">{gmailConnected ? gmailEmail : "Not connected"}</p>
            </div>
            {gmailConnected ? (
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-destructive" onClick={onDisconnectGmail}>
                <LogOut className="w-2.5 h-2.5" />
              </Button>
            ) : (
              <Button size="sm" className="h-5 px-2 text-[9px]" onClick={onConnectGmail} disabled={connecting}>
                {connecting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Connect"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", rcConnected ? "bg-blue-500/15" : "bg-muted")}>
              <Phone className={cn("w-3 h-3", rcConnected ? "text-blue-400" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium">RingCentral</p>
              <p className="text-[9px] text-muted-foreground truncate">{rcConnected ? rcEmail : "Not connected"}</p>
            </div>
            {rcConnected ? (
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-destructive" onClick={onDisconnectRC}>
                <LogOut className="w-2.5 h-2.5" />
              </Button>
            ) : (
              <Button size="sm" className="h-5 px-2 text-[9px]" onClick={onConnectRC} disabled={rcConnecting}>
                {rcConnecting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Connect"}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Utility */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={selectionMode ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={toggleSelectMode}>
            {selectionMode ? <X className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{selectionMode ? "Exit selection" : "Select"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Sync</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSettings}>
            <Settings className="w-3 h-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Settings</TooltipContent>
      </Tooltip>
    </div>
  );
}
