import { Clapperboard } from "lucide-react";
import { AdDirectorContent } from "@/components/ad-director/AdDirectorContent";
import { AdDirectorErrorBoundary } from "@/components/ad-director/AdDirectorErrorBoundary";

export default function AdDirector() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header — hide in editing mode */}
      {!isEditing && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4 pb-1">
          <div className="flex items-center gap-3">
            <Clapperboard className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">AI Video Director</h1>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={isEditing ? "w-full px-2 pb-2 pt-1 h-full" : "max-w-4xl mx-auto w-full px-4 pb-8 pt-4"}>
          <AdDirectorErrorBoundary>
            <AdDirectorContent onEditingChange={setIsEditing} />
          </AdDirectorErrorBoundary>
        </div>
      </div>
    </div>
  );
}
