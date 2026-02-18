import { SalaryDividendCalculator } from "./tax/SalaryDividendCalculator";
import { VickyTaskList } from "./tax/VickyTaskList";
import { DeductionChecklist } from "./tax/DeductionChecklist";
import { HSATracker } from "./tax/HSATracker";
import { CCAPlanner } from "./tax/CCAPlanner";
import { YearEndPlaybook } from "./tax/YearEndPlaybook";
import { ProfitRetentionPolicy } from "./tax/ProfitRetentionPolicy";
import { GSTHSTReview } from "./tax/GSTHSTReview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMBINED_CORP_RATE } from "@/lib/tax/canadianTaxRates";
import { formatCurrency } from "@/lib/tax/taxCalculator";

export function TaxPlanning() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">🏛️ Tax Planning — CPA Playbook</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Corporate tax optimization for Canadian owner-managed businesses (Ontario). Combined SBD rate: {(COMBINED_CORP_RATE * 100).toFixed(1)}%
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Corp Tax Rate (SBD)</p>
            <p className="text-3xl font-bold text-primary">{(COMBINED_CORP_RATE * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">vs. 30-50% personal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Per $100K Kept in Corp</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(100000 * (0.35 - COMBINED_CORP_RATE))}</p>
            <p className="text-xs text-muted-foreground">tax deferral savings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Strategy</p>
            <p className="text-xl font-bold text-primary">Dividend First</p>
            <p className="text-xs text-muted-foreground">No CPP, flexible timing</p>
          </CardContent>
        </Card>
      </div>

      {/* Main sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalaryDividendCalculator />
        <VickyTaskList />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HSATracker />
        <ProfitRetentionPolicy />
      </div>

      <DeductionChecklist />
      <GSTHSTReview />
      <CCAPlanner />
      <YearEndPlaybook />
    </div>
  );
}
