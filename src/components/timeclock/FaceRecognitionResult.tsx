import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, AlertTriangle, X, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecognitionState } from "@/hooks/useFaceRecognition";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface FaceRecognitionResultProps {
  state: RecognitionState;
  matchResult: {
    profile_id: string;
    name: string;
    confidence: number;
    reason: string;
    avatar_url: string | null;
  } | null;
  isClockedIn: boolean;
  onConfirmPunch: (profileId: string) => void;
  onReject: () => void;
  autoPunchCountdown?: number;
}

export function FaceRecognitionResult({
  state,
  matchResult,
  isClockedIn,
  onConfirmPunch,
  onReject,
  autoPunchCountdown,
}: FaceRecognitionResultProps) {
  if (state === "idle" || state === "scanning") return null;

  if (state === "no_match" || state === "error") {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6 text-center space-y-2">
          <X className="w-10 h-10 mx-auto text-destructive" />
          <h3 className="font-bold text-lg">
            {state === "no_match" ? "No Match Found" : "Recognition Error"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {state === "no_match"
              ? "Your face was not recognized. Please try again or use manual punch."
              : "Something went wrong. Please try again."}
          </p>
          <Button variant="outline" onClick={onReject} className="mt-2">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!matchResult) return null;

  const isHighConfidence = state === "matched";
  const action = isClockedIn ? "Clock Out" : "Clock In";
  const ActionIcon = isClockedIn ? LogOut : LogIn;

  return (
    <Card
      className={cn(
        "transition-all",
        isHighConfidence
          ? "border-green-500/40 bg-green-500/5"
          : "border-warning/40 bg-warning/5"
      )}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={matchResult.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
              {getInitials(matchResult.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{matchResult.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isHighConfidence ? (
                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
                  <Check className="w-3 h-3" /> {matchResult.confidence}% Match
                </Badge>
              ) : (
                <Badge className="bg-warning/15 text-warning border-warning/30 gap-1">
                  <AlertTriangle className="w-3 h-3" /> {matchResult.confidence}% Match
                </Badge>
              )}
            </div>
          </div>
        </div>

        {isHighConfidence && autoPunchCountdown !== undefined && autoPunchCountdown > 0 && (
          <p className="text-sm text-center text-muted-foreground">
            Auto {action.toLowerCase()} in <span className="font-bold text-foreground">{autoPunchCountdown}s</span>...
          </p>
        )}

        {!isHighConfidence && (
          <p className="text-sm text-center text-muted-foreground">
            Confidence below 95%. Please confirm your identity.
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onReject}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button
            className={cn(
              "flex-1 gap-2 font-bold",
              isClockedIn
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
            onClick={() => onConfirmPunch(matchResult.profile_id)}
          >
            <ActionIcon className="w-4 h-4" /> {action}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
