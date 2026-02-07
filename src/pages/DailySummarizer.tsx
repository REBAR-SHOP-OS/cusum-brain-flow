import { useState } from "react";
import { subDays, addDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useDailyDigest } from "@/hooks/useDailyDigest";
import { DigestHeader } from "@/components/daily-digest/DigestHeader";
import { DigestContent } from "@/components/daily-digest/DigestContent";

export default function DailySummarizer() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { digest, stats, loading, error, refetch } = useDailyDigest(currentDate);

  const goToPreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  return (
    <div className="flex flex-col h-full bg-background">
      <DigestHeader
        currentDate={currentDate}
        onPreviousDay={goToPreviousDay}
        onNextDay={goToNextDay}
        onRefresh={refetch}
        loading={loading}
      />

      <ScrollArea className="flex-1">
        {loading && (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="w-48 h-48 rounded-full" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="max-w-3xl mx-auto p-6">
            <Card>
              <CardContent className="py-8 text-center space-y-4">
                <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={refetch} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {digest && !loading && (
          <DigestContent digest={digest} stats={stats} currentDate={currentDate} />
        )}
      </ScrollArea>
    </div>
  );
}
