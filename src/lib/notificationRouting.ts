export function normalizeNotificationRoute(linkTo: string, type?: string): string {
  let dest = linkTo;
  if (/^\/hr(\/|$)/.test(dest)) dest = "/timeclock";
  else if (/^\/estimation(\/|$)/.test(dest)) dest = "/pipeline";
  else if (/^\/(bills|invoicing)(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/invoices(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/accounting\/(bills|invoices)(\/|$)/.test(dest)) dest = "/accounting";
  else if (/^\/intelligence(\/|$)/.test(dest)) dest = "/brain";
  else if (/^\/inventory(\/|$)/.test(dest)) dest = "/shop-floor";
  else if (/^\/emails(\/|$)/.test(dest)) dest = "/inbox";
  else if (/^\/inbox\/[a-f0-9-]+$/i.test(dest)) dest = "/inbox";
  // To-do items must never land on /brain
  if (type === "todo" && dest === "/brain") dest = "/tasks";
  return dest;
}
