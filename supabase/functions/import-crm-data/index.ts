import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadData {
  title: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  expected_value: number | null;
  probability: number;
  stage: string;
  priority: string;
  source: string;
  deadline: string | null;
  notes: string;
}

function mapStage(odooStage: string): string {
  const s = odooStage.toLowerCase();
  if (s.includes("delivered") || s.includes("pickup done")) return "won";
  if (s.includes("loss")) return "lost";
  if (s.includes("no rebars") || s.includes("out of scope") || s.includes("our of scope")) return "lost";
  if (s.includes("quotation bids")) return "proposal";
  if (s.includes("quotation priority")) return "qualified";
  if (s.includes("shop drawing")) return "qualified";
  return "new";
}

const leadsData: LeadData[] = [
  { title: "S01267-Morrison Construction: S2-17 - TTC College - Pole Bases", company_name: "MORRISON CONSTRUCTION INNOVATIONS", contact_name: "MORRISON CONSTRUCTION INNOVATIONS", email: "leemorrison@mcinnovations.ca", phone: "+1 705-957-1430", expected_value: null, probability: 68, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-07-31", notes: "Assigned: Saurabh Sehgal | City: UXBRIDGE | Quote: S01267" },
  { title: "S01262, Melfer #2: Oshawa - Easton Park Redevelopment", company_name: "CONCRETE.N.THING INC. (MELFER Construction)", contact_name: "MELFER CONSTRUCTION INC.", email: "mdandrea@melfer.ca", phone: "+1 905-642-9405", expected_value: null, probability: 98, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: "2025-07-30", notes: "Assigned: Saurabh Sehgal | Quote: S01262" },
  { title: "S01263, Melfer: Easton Park, Oshawa", company_name: "CONCRETE.N.THING INC. (MELFER Construction)", contact_name: "MELFER CONSTRUCTION INC.", email: "mdandrea@melfer.ca", phone: "+1 905-642-9405", expected_value: null, probability: 98, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: "2025-07-30", notes: "Assigned: Saurabh Sehgal | Quote: S01263" },
  { title: "S01203, JNL Construction: Rebar quote", company_name: "JNL Construction Group", contact_name: "Scott", email: "jnlconstgroup@gmail.com", phone: "+1 647-885-9672", expected_value: null, probability: 99, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: "2025-07-23", notes: "Assigned: Saurabh Sehgal | City: Toronto | Quote: S01203" },
  { title: "BDA Inc: CofM Fire Station 103 and 111 - Tender Packages", company_name: "BDA Inc", contact_name: "Scott", email: "Jessica@bda.ca", phone: "+1 416-251-1757", expected_value: 75071.50, probability: 36, stage: mapStage("Quotation Bids"), priority: "high", source: "odoo-import", deadline: "2025-08-13", notes: "Assigned: Saurabh Sehgal | Vendor: Maverick | City: Toronto | Quote: S01306" },
  { title: "S01160, Maicom: 244 Newkirk 15mm Rebar", company_name: "Maicom Canada Corp.", contact_name: "Scott", email: "m.magbanua@maicomllc.com", phone: "+1 416-558-5368", expected_value: null, probability: 97, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | City: Toronto | Quote: S01160" },
  { title: "S01159, KCL - Damien", company_name: "Key Construction Landscape", contact_name: "Scott", email: "damien.lambert@hotmail.com", phone: "+1 289-383-0556", expected_value: null, probability: 86, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | City: Barrie | Quote: S01159" },
  { title: "S01153, TIMES, 16A Tudor Gate - Quote", company_name: "Times 1128 Inc.", contact_name: "Times Group", email: "hamid@timesgroup.ca", phone: "905-940-6286", expected_value: null, probability: 99, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Sattar Esmaeili | City: Markham | Quote: S02202" },
  { title: "S01141: 25725 33 West Beaver Creek Rebar RFQ", company_name: "Clearway Construction Inc.", contact_name: "Clearway Construction", email: "matthewdutra@clearwaygroup.com", phone: "+1 647-327-0478", expected_value: null, probability: 89, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-07-23", notes: "Assigned: Saurabh Sehgal | Vendor: Maverick | Quote: S01141" },
  { title: "S01131, Valard: plates", company_name: "Valard Construction LP", contact_name: "Scott", email: "GSorge@valard.com", phone: "+1 780-436-9876", expected_value: null, probability: 100, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-07-11", notes: "Assigned: Saurabh Sehgal | City: Edmonton | Quote: S01131" },
  { title: "S01129, Rigarus: C8686 Rebar", company_name: "Rigarus Construction inc", contact_name: "Rigarus Construction inc", email: "appal.thapa@rigarus.com", phone: "+1 519-669-5040", expected_value: null, probability: 87, stage: mapStage("Loss"), priority: "high", source: "odoo-import", deadline: "2025-07-10", notes: "Assigned: Saurabh Sehgal | Quote: S01129 | On Hold" },
  { title: "S01119, Maren Construction Inc- Anthony Fusco: Order", company_name: "Maren Construction Inc", contact_name: "Maren Construction Inc", email: "anthonyfusco123@gmail.com", phone: "+1 416-728-5333", expected_value: null, probability: 83, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-07-08", notes: "Assigned: Saurabh Sehgal | City: Toronto | Quote: S01119" },
  { title: "S01120, McInnovations: 9 Channel Nine Court RFQ", company_name: "Lee Morrison (McInnovations)", contact_name: "Lee Morrison", email: "leemorrison@mcinnovations.ca", phone: "+1 705-957-1430", expected_value: 3300, probability: 36, stage: mapStage("Quotation Bids"), priority: "high", source: "odoo-import", deadline: "2025-07-08", notes: "Assigned: Saurabh Sehgal | Quote: S01120" },
  { title: "S01115: Cable bus caissons - TOR1A Data center", company_name: "Verdi Alliance Group of Companies", contact_name: "Swapnil Mahajan", email: "SDiGiovanni@verdialliance.com", phone: "+1 416-749-5030", expected_value: null, probability: 46, stage: mapStage("Quotation Priority"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | City: Bolton | Quote: S01115 | QC pending" },
  { title: "S01210, Martinway: Brampton Christian school", company_name: "Martinway Contracting Ltd", contact_name: "MARTINWAY CONTRACTING", email: "Robert@martinwaycontracting.com", phone: "+1 416-999-9187", expected_value: null, probability: 93, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-07-25", notes: "Assigned: Saurabh Sehgal | Quote: S01210" },
  { title: "S01086, Melfer 15M stirrups: Purchase Order", company_name: "CONCRETE.N.THING INC. (MELFER Construction)", contact_name: "", email: "ap@melfer.ca", phone: "+1 416-951-8282", expected_value: null, probability: 91, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S01086" },
  { title: "S01088, RBA Projects-176 Van Dusen - Reinforcement Delivery", company_name: "RBA PROJECTS", contact_name: "RBA PROJECTS", email: "will@rbaprojects.com", phone: "+1 437-551-3927", expected_value: null, probability: 84, stage: mapStage("Loss"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S01088" },
  { title: "S01085, Armando Ortega- 10M Stirrups", company_name: "Armando Ortega (OMNICON CONTRACTING INC.)", contact_name: "Armando Ortega", email: "armando.ortega@omniconinc.ca", phone: "+1 416-829-6996", expected_value: null, probability: 83, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S01085" },
  { title: "S01084, Melfer: Purchase Order - stirrups", company_name: "MELFER Construction", contact_name: "", email: "ap@melfer.ca", phone: "+1 416-346-7766", expected_value: null, probability: 71, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S01084" },
  { title: "S01145, Sector Contracting Ltd. Rebar Shop", company_name: "Sector Contracting Ltd", contact_name: "Sector Contracting Ltd", email: "jdsector4@aol.com", phone: "+1 416-984-2769", expected_value: null, probability: 9, stage: mapStage("Quotation Bids"), priority: "high", source: "odoo-import", deadline: "2025-07-07", notes: "Assigned: Saurabh Sehgal | Vendor: A&A Consulting | City: Whitby | Quote: S01145" },
  { title: "S00868 Martinway: 15 Tobermory Street - RFQ 25126-PP", company_name: "Martinway Contracting Ltd", contact_name: "MARTINWAY CONTRACTING", email: "Robert@martinwaycontracting.com", phone: "+1 416-999-9187", expected_value: null, probability: 89, stage: mapStage("Loss"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S00868" },
  { title: "S00886 Martinway: 1021 Birchmount RD - Common area accessibility", company_name: "Martinway Contracting Ltd", contact_name: "MARTINWAY CONTRACTING", email: "Robert@martinwaycontracting.com", phone: "+1 416-999-9187", expected_value: null, probability: 90, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Vendor: Maverick | Quote: S00886" },
  { title: "S00808 Bronte Construction: REQ 008 - Halford Avenue Project", company_name: "BRONTE CONSTRUCTION (2220742 Ontario Ltd.)", contact_name: "Berto Muller", email: "bmuller@bronteconstruction.ca", phone: "+1 437-455-0435", expected_value: null, probability: 9, stage: mapStage("Shop Drawing"), priority: "high", source: "odoo-import", deadline: "2025-05-09", notes: "Assigned: Saurabh Sehgal | Vendor: Maverick | City: Burlington | Quote: S02493" },
  { title: "Northfleet Group's opportunity", company_name: "Northfleet Group", contact_name: "", email: "alex@northfleet.ca", phone: "+1 647-262-2238", expected_value: null, probability: 71, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Vendor: Maverick | Quote: S00658" },
  { title: "Morrison Construction- sidewalk pole PADS", company_name: "Lee Morrison (McInnovations)", contact_name: "Lee Morrison", email: "leemorrison@mcinnovations.ca", phone: "+1 705-957-1430", expected_value: null, probability: 89, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | Quote: S00649" },
  { title: "Vallard bollards Concord", company_name: "Valard Construction LP", contact_name: "Mike Heeringa", email: "GSorge@valard.com", phone: "+1 780-436-9876", expected_value: null, probability: 73, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Saurabh Sehgal | City: Concord | Quote: S00625" },
  { title: "FW: 25-027 Middlesex County Governance & Administration Centre", company_name: "Norlon Builders", contact_name: "Matthew Pilecki", email: "mpilecki@norlon.ca", phone: "+1 519-672-7590 ext. 108", expected_value: null, probability: 60, stage: mapStage("Loss"), priority: "high", source: "odoo-import", deadline: "2025-04-15", notes: "Assigned: Swapnil Mahajan | Quote: S00678" },
  { title: "FW: Request for Quotation - Townline Bridges, Zephyr Road", company_name: "Mianco Infrastructure", contact_name: "Abdul Majid", email: "abdul.majid@miancogroup.com", phone: "+1 905-251-0481", expected_value: null, probability: 95, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Vendor: A&A Consulting | City: Stouffville" },
  { title: "S00401: Township Of Zorra - Replacement Of Structure 108", company_name: "Cox Construction Limited", contact_name: "Cox Construction Limited", email: "mdmcdonald@coxconstruction.ca", phone: "+1 519-654-2421", expected_value: 6164.15, probability: 57, stage: mapStage("Quotation Bids"), priority: "high", source: "odoo-import", deadline: "2025-03-07", notes: "Assigned: Swapnil Mahajan | Quote: S00401" },
  { title: "FW: Oak Valley Health- Uxbridge Hospital", company_name: "Black & McDonald Limited", contact_name: "Ross Maniaci", email: "rmaniaci@blackandmcdonald.com", phone: "+1 416-553-0475", expected_value: 18452.90, probability: 12, stage: mapStage("Quotation Priority"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Quote: S00373" },
  { title: "S00356- Lia Electric's Cage Opportunity", company_name: "Lia Electric", contact_name: "", email: "kyle@liaelectric.com", phone: "+1 647-927-1677", expected_value: null, probability: 15, stage: mapStage("Quotation Priority"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Quote: S00356" },
  { title: "S00310, Greenwood College capcon", company_name: "Capcon", contact_name: "Capcon", email: "john@capconconstruction.ca", phone: "+1 647-779-9117", expected_value: null, probability: 98, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Quote: S00310" },
  { title: "S00298: TPC Toronto at Osprey valley", company_name: "Capcon Construction", contact_name: "Capcon Construction", email: "john@capconconstruction.ca", phone: "+1 647-779-9117", expected_value: null, probability: 98, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Quote: S00298" },
  { title: "Joseph's Walls opportunity", company_name: "Hydro One", contact_name: "Hydro One", email: "joseph.wall@hydroone.com", phone: "+1 416-577-6008", expected_value: null, probability: 99, stage: mapStage("No rebars(Our of Scope)"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson" },
  { title: "ZB rebar cage", company_name: "ZB Construction", contact_name: "", email: "zephyrbrosconstruction@gmail.com", phone: "+1 905-213-4415", expected_value: null, probability: 60, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: null, notes: "Assigned: Josh Anderson | Quote: S00294" },
  { title: "FW: Canada Post Phase 2 - Price for Rebar", company_name: "BERKIM CONSTRUCTION INC.", contact_name: "Victoria Silva", email: "victorias@berkim.com", phone: "+1 416-224-2550", expected_value: null, probability: 100, stage: mapStage("Delivered/Pickup Done"), priority: "high", source: "odoo-import", deadline: "2025-02-05", notes: "Assigned: Swapnil Mahajan | Vendor: Maverick | Quote: S01643" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = { customers_created: 0, leads_created: 0, errors: [] as string[] };
    const customerCache: Record<string, string> = {};

    for (const lead of leadsData) {
      try {
        // Check if customer exists or create new one
        let customerId = customerCache[lead.company_name];
        
        if (!customerId) {
          // Check existing customer
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("name", lead.company_name)
            .maybeSingle();

          if (existing) {
            customerId = existing.id;
          } else {
            const { data: newCustomer, error: custErr } = await supabase
              .from("customers")
              .insert({
                name: lead.company_name,
                company_name: lead.company_name,
                customer_type: "business",
                status: "active",
                notes: `Imported from Odoo CRM`,
                company_id: "a0000000-0000-0000-0000-000000000001",
              })
              .select("id")
              .single();

            if (custErr) {
              results.errors.push(`Customer ${lead.company_name}: ${custErr.message}`);
              continue;
            }
            customerId = newCustomer.id;
            results.customers_created++;
          }
          customerCache[lead.company_name] = customerId;
        }

        // Create contact if we have contact info
        if (lead.contact_name && lead.email) {
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("email", lead.email.split(",")[0].trim())
            .eq("customer_id", customerId)
            .maybeSingle();

          if (!existingContact) {
            const nameParts = lead.contact_name.replace(/<[^>]*>/g, "").trim().split(" ");
            await supabase.from("contacts").insert({
              first_name: nameParts[0] || lead.contact_name,
              last_name: nameParts.slice(1).join(" ") || null,
              email: lead.email.split(",")[0].trim(),
              phone: lead.phone,
              customer_id: customerId,
              is_primary: true,
              company_id: "a0000000-0000-0000-0000-000000000001",
            });
          }
        }

        // Check for duplicate lead
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("title", lead.title)
          .eq("customer_id", customerId)
          .maybeSingle();

        if (existingLead) {
          continue; // Skip duplicate
        }

        // Create lead
        const { error: leadErr } = await supabase.from("leads").insert({
          title: lead.title,
          customer_id: customerId,
          stage: lead.stage,
          priority: lead.priority,
          probability: lead.probability,
          expected_value: lead.expected_value,
          expected_close_date: lead.deadline,
          source: lead.source,
          notes: lead.notes,
        });

        if (leadErr) {
          results.errors.push(`Lead ${lead.title}: ${leadErr.message}`);
        } else {
          results.leads_created++;
        }
      } catch (e) {
        results.errors.push(`${lead.title}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
