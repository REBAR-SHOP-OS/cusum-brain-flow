import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtractWorkbench } from "./ExtractWorkbench";
import { ProductionControl } from "./ProductionControl";
import { DispatchControl } from "./DispatchControl";
import { CashControl } from "./CashControl";

export function CEODashboards() {
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-lg font-bold mb-4">Operations Control</h2>
      <Tabs defaultValue="extract" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="extract">Extracts</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
          <TabsTrigger value="cash">Cash</TabsTrigger>
        </TabsList>
        <TabsContent value="extract"><ExtractWorkbench /></TabsContent>
        <TabsContent value="production"><ProductionControl /></TabsContent>
        <TabsContent value="dispatch"><DispatchControl /></TabsContent>
        <TabsContent value="cash"><CashControl /></TabsContent>
      </Tabs>
    </div>
  );
}
