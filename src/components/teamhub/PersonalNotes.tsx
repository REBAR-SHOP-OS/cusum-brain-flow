import { useState, useRef, useEffect, useCallback } from "react";
import { usePersonalNotes, type UserNote } from "@/hooks/usePersonalNotes";
import { useCompanyId } from "@/hooks/useCompanyId";
import type { Profile } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  StickyNote,
  Search,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface PersonalNotesProps {
  myProfile: Profile;
}

export function PersonalNotes({ myProfile }: PersonalNotesProps) {
  const { companyId } = useCompanyId();
  const { notes, isLoading, createNote, updateNote, deleteNote } = usePersonalNotes(myProfile.id, companyId ?? undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNote = notes.find((n) => n.id === selectedId);

  // sync editor when selection changes
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
    }
  }, [selectedNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoSave = useCallback(
    (title: string, content: string) => {
      if (!selectedId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNote.mutate({ id: selectedId, title, content });
      }, 800);
    },
    [selectedId, updateNote]
  );

  const handleTitleChange = (val: string) => {
    setEditTitle(val);
    autoSave(val, editContent);
  };

  const handleContentChange = (val: string) => {
    setEditContent(val);
    autoSave(editTitle, val);
  };

  const handleCreate = async () => {
    const result = await createNote.mutateAsync({ title: "Untitled", content: "" });
    if (result?.id) setSelectedId(result.id);
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate(id);
    if (selectedId === id) setSelectedId(null);
  };

  const filtered = searchTerm
    ? notes.filter((n) => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : notes;

  // Mobile: show editor when note selected, list otherwise
  if (selectedNote) {
    return (
      <div className="flex flex-col h-full">
        {/* Editor header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={editTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-sm font-semibold border-none bg-transparent shadow-none focus-visible:ring-0 px-0"
            placeholder="Note title..."
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => handleDelete(selectedNote.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        {/* Editor body */}
        <div className="flex-1 p-4 overflow-auto">
          <Textarea
            value={editContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Write your notes here..."
            className="min-h-[300px] border-none bg-transparent shadow-none focus-visible:ring-0 resize-none text-sm"
          />
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border">
          Auto-saved • Last updated {selectedNote.updated_at ? format(new Date(selectedNote.updated_at), "MMM d, h:mm a") : "—"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">My Notes</h2>
          <span className="text-xs text-muted-foreground">({notes.length})</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleCreate} disabled={createNote.isPending}>
          {createNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          New Note
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/50 border-transparent focus:border-primary/30"
          />
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <StickyNote className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "No notes found" : "No notes yet. Create your first note!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group",
                  selectedId === note.id && "bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {note.title || "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {note.content?.slice(0, 80) || "Empty note"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {format(new Date(note.updated_at), "MMM d")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
