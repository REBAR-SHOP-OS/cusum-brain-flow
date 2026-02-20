import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Option {
  qb_id: string;
  name: string;
}

interface Props {
  type: "class" | "department";
  value?: string;
  onChange: (qbId: string | undefined) => void;
  label?: string;
  className?: string;
}

export function ClassDepartmentPicker({ type, value, onChange, label, className }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const table = type === "class" ? "qb_classes" : "qb_departments";
        const { data } = await supabase
          .from(table)
          .select("qb_id, name")
          .eq("is_active", true)
          .order("name");
        if (!cancelled && data) {
          setOptions(data as unknown as Option[]);
        }
      } catch {
        // Silently fail — picker is optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [type]);

  if (options.length === 0 && !loading) return null;

  return (
    <div className={className}>
      <Label className="text-xs">{label || (type === "class" ? "Class" : "Department")}</Label>
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? undefined : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={`Select ${type}...`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {options.map(o => (
            <SelectItem key={o.qb_id} value={o.qb_id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
