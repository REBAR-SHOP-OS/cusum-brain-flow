
import { salesPrompts } from "./agents/sales.ts";
import { accountingPrompts } from "./agents/accounting.ts";
import { operationsPrompts } from "./agents/operations.ts";
import { supportPrompts } from "./agents/support.ts";
import { marketingPrompts } from "./agents/marketing.ts";
import { growthPrompts } from "./agents/growth.ts";
import { specialistsPrompts } from "./agents/specialists.ts";
import { empirePrompts } from "./agents/empire.ts";

export const agentPrompts: Record<string, string> = {
  ...salesPrompts,
  ...accountingPrompts,
  ...operationsPrompts,
  ...supportPrompts,
  ...marketingPrompts,
  ...growthPrompts,
  ...specialistsPrompts,
  ...empirePrompts,
};
