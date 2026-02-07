import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors, Wrench, Truck, Factory } from "lucide-react";
import type { LiveMachine } from "@/types/machine";

interface MachineSelectorProps {
  machines: LiveMachine[];
}

const typeIcons: Record<string, React.ReactNode> = {
  cutter: <Scissors className="w-8 h-8" />,
  bender: <Wrench className="w-8 h-8" />,
  loader: <Truck className="w-8 h-8" />,
  other: <Factory className="w-8 h-8" />,
};

const statusColors: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-success/20 text-success",
  blocked: "bg-warning/20 text-warning",
  down: "bg-destructive/20 text-destructive",
};

export function MachineSelector({ machines }: MachineSelectorProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
          Select Fabrication Unit
        </h2>
        <Badge variant="outline" className="text-xs">{machines.length}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {machines.map((machine) => (
          <Card
            key={machine.id}
            className="cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-all group"
            onClick={() => navigate(`/shopfloor/station/${machine.id}`)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                {typeIcons[machine.type] || typeIcons.other}
              </div>
              <div>
                <p className="font-semibold text-sm">{machine.name}</p>
                {machine.model && (
                  <p className="text-xs text-muted-foreground">{machine.model}</p>
                )}
              </div>
              <Badge className={statusColors[machine.status] || statusColors.idle} variant="outline">
                {machine.status.toUpperCase()}
              </Badge>
              {machine.operator && (
                <p className="text-xs text-muted-foreground truncate w-full">
                  {machine.operator.full_name}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
