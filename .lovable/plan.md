

# Add Anonymous Read Policies for Leads and Customers

Two RLS policies granting anonymous (`anon`) read access:

1. **leads table**: `CREATE POLICY "Allow anon read access for leads" ON public.leads FOR SELECT TO anon USING (true);`
2. **customers table**: `CREATE POLICY "Allow anon read access for customers" ON public.customers FOR SELECT TO anon USING (true);`

This is a single database migration with both policy statements.

