import { ChevronDown, Settings, History, Brain, Plug, Camera, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SidebarSection } from "@/hooks/useAppBuilderProject";

interface Props {
  projectName: string;
  onSelect: (s: SidebarSection) => void;
}

export function AppBuilderSettingsMenu({ projectName, onSelect }: Props) {
  return (
    <div className="border-b border-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left">
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground text-sm truncate">
                {projectName || "New App"}
              </h2>
              <span className="text-xs text-muted-foreground">App Builder</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => onSelect("settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Project Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect("versions")}>
            <History className="w-4 h-4 mr-2" />
            History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect("knowledge")}>
            <Brain className="w-4 h-4 mr-2" />
            Knowledge
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect("connectors")}>
            <Plug className="w-4 h-4 mr-2" />
            Connectors
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Camera className="w-4 h-4 mr-2" />
            Take Screenshot
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Paperclip className="w-4 h-4 mr-2" />
            Attach File
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
