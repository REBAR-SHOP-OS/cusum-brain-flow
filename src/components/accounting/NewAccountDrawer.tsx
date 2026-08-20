import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const ACCOUNT_TYPES: Record<string, string[]> = {
  ASSET: ["Bank", "Accounts Receivable", "Other Current Asset", "Fixed Asset", "Other Asset"],
  LIABILITY: ["Credit Card", "Accounts Payable", "Other Current Liability", "Long Term Liability"],
  EQUITY: ["Equity"],
  INCOME: ["Income", "Other Income"],
  EXPENSE: ["Cost of Goods Sold", "Expense", "Other Expense"],
};

const DETAIL_TYPES: Record<string, string[]> = {
  "Bank": ["CashOnHand", "Checking", "MoneyMarket", "RentsHeldInTrust", "Savings", "TrustAccounts"],
  "Accounts Receivable": ["AccountsReceivable"],
  "Other Current Asset": ["AllowanceForBadDebts", "DevelopmentCosts", "EmployeeCashAdvances", "Inventory", "Investment_MortgageRealEstateLoans", "Investment_Other", "Investment_TaxExemptSecurities", "Investment_USGovernmentObligations", "LoansToOfficers", "LoansToOthers", "LoansToStockholders", "OtherCurrentAssets", "PrepaidExpenses", "Retainage", "UndepositedFunds"],
  "Fixed Asset": ["AccumulatedDepletion", "AccumulatedDepreciation", "Buildings", "DepletableAssets", "FixedAssetComputers", "FixedAssetCopiers", "FixedAssetFurniture", "FixedAssetPhone", "FixedAssetPhotoVideo", "FixedAssetSoftware", "FixedAssetOtherToolsEquipment", "FurnitureAndFixtures", "Land", "LeaseholdImprovements", "MachineryAndEquipment", "OtherFixedAssets", "Vehicles"],
  "Other Asset": ["AccumulatedAmortization", "GoodWill", "IntangibleAssets", "LeaseBuyout", "Licenses", "OrganizationalCosts", "OtherLongTermAssets", "SecurityDeposits"],
  "Credit Card": ["CreditCard"],
  "Accounts Payable": ["AccountsPayable"],
  "Other Current Liability": ["DirectDepositPayable", "FederalIncomeTaxPayable", "InsurancePremiumsPayable", "LineOfCredit", "LoanPayable", "OtherCurrentLiabilities", "PayrollClearing", "PayrollTaxPayable", "PrepaidRevenue", "SalesTaxPayable", "StateLocalIncomeTaxPayable"],
  "Long Term Liability": ["NotesPayable", "OtherLongTermLiabilities", "ShareholderNotesPayable"],
  "Equity": ["AccumulatedAdjustment", "CommonStock", "EstimatedTaxes", "HealthInsurance", "OpeningBalanceEquity", "PartnersEquity", "PersonalExpense", "PersonalIncome", "PreferredStock", "RetainedEarnings", "TreasuryStock"],
  "Income": ["DiscountsRefundsGiven", "NonProfitIncome", "OtherPrimaryIncome", "SalesOfProductIncome", "ServiceFeeIncome", "UnappliedCashPaymentIncome"],
  "Other Income": ["DividendIncome", "InterestEarned", "OtherInvestmentIncome", "OtherMiscIncome", "TaxExemptInterest", "UnrealisedLossOnSecuritiesNetOfTax"],
  "Cost of Goods Sold": ["CostOfLaborCos", "EquipmentRentalCos", "FreightAndDeliveryCos", "OtherCostsOfServiceCos", "ShippingFreightDeliveryCos", "SuppliesMaterialsCogs"],
  "Expense": ["AdvertisingPromotional", "Auto", "BadDebts", "BankCharges", "CharitableContributions", "CommissionsAndFees", "Entertainment", "EntertainmentMeals", "EquipmentRental", "FinanceCosts", "GlobalTaxExpense", "Insurance", "InterestPaid", "LegalProfessionalFees", "OfficeExpenses", "OfficeGeneralAdministrativeExpenses", "OtherBusinessExpenses", "OtherMiscellaneousServiceCost", "PayrollExpenses", "RentOrLeaseOfBuildings", "RepairMaintenance", "ShippingFreightDelivery", "SuppliesMaterials", "TaxesPaid", "Travel", "TravelMeals", "Utilities"],
  "Other Expense": ["Amortization", "Depreciation", "ExchangeGainOrLoss", "GasAndFuel", "HomeOffice", "HomeOwnerRentalInsurance", "MortgageInterest", "OtherHomeOfficeExpenses", "OtherMiscellaneousExpense", "OtherVehicleExpenses", "ParkingAndTolls", "PenaltiesSettlements", "PropertyTax", "Taxes", "Vehicle", "VehicleInsurance", "VehicleLease", "VehicleLoanInterest", "VehicleLoan", "VehicleRegistration", "VehicleRepairs", "WashAndRoadServices"],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewAccountDrawer({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [detailType, setDetailType] = useState("");

  const detailOptions = accountType ? (DETAIL_TYPES[accountType] || []) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountType) {
      toast({ title: "Account name and type are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "create-account", name: name.trim(), accountType, accountSubType: detailType || undefined },
      });
      if (error) throw new Error(error.message);
      toast({ title: "✅ Account created", description: `${name} added to QuickBooks` });
      setName(""); setAccountType(""); setDetailType("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({ title: "Failed to create account", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New Account</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
          <div>
            <Label>Account Type *</Label>
            <Select value={accountType} onValueChange={(v) => { setAccountType(v); setDetailType(""); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select account type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPES).map(([category, types]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{category}</SelectLabel>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {detailOptions.length > 0 && (
            <div>
              <Label>Detail Type</Label>
              <Select value={detailType} onValueChange={setDetailType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select detail type" /></SelectTrigger>
                <SelectContent>
                  {detailOptions.map((d) => (
                    <SelectItem key={d} value={d}>{d.replace(/([A-Z])/g, " $1").trim()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Account Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Chequing" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Save"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
