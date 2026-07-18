# Supabase Security Policy Fix - Required to Enable Edit & Delete Features

## Issue
The sales/expenses/inventory edit feature is not working because Supabase Row-Level Security (RLS) policies are missing for UPDATE operations. The policies only allow SELECT and INSERT, blocking all UPDATE requests.

**Symptoms:**
- Edit buttons appear and form populates correctly
- PATCH requests succeed (204 status)
- But database doesn't update, and the list doesn't refresh

## Solution
You need to run these SQL statements in your Supabase SQL Editor to add missing UPDATE policies.

### Steps:

1. **Log in to your Supabase Dashboard:**
   - Go to: https://app.supabase.com/project/zczxusyfepcblgelzmep/sql
   - Sign in with your credentials

2. **Open the SQL Editor** (click "SQL Editor" in left sidebar)

3. **Copy and paste the following SQL statements** one at a time and execute each:

```sql
-- Add UPDATE policy for SALES table
create policy "Users can update own sales" on sales 
  for update 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);
```

```sql
-- Add UPDATE policy for EXPENSES table
create policy "Users can update own expenses" on expenses 
  for update 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);
```

```sql
-- Add UPDATE policy for STOCK table
create policy "Users can update own stock" on stock 
  for update 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);
```

```sql
-- Add DELETE policy for SALES table
create policy "Users can delete own sales" on sales 
  for delete 
  using (auth.uid() = user_id);
```

```sql
-- Add DELETE policy for EXPENSES table
create policy "Users can delete own expenses" on expenses 
  for delete 
  using (auth.uid() = user_id);
```

```sql
-- Add DELETE policy for STOCK table
create policy "Users can delete own stock" on stock 
  for delete 
  using (auth.uid() = user_id);
```

4. **Verify** each statement executes successfully (look for "Success" message)

5. **Test in your app:**
   - Close and reopen http://localhost:3000/ in your browser
   - Try editing or deleting a sale - it should now update/delete and reflect immediately in the list

## What Was Changed in app.js

Your `public/app.js` has been updated to:
- Add `.select('*')` to update queries so they return the updated rows
- Validate that at least one row was updated
- Surface clear error messages if updates fail

These changes prepare the app to work correctly once the Supabase policies are in place.

## Troubleshooting

**If the fix doesn't work after applying SQL:**
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Check browser console (F12) for any error messages
3. Verify the SQL executed without errors in Supabase

**If you see "No updated rows returned" error:**
- The SQL policies haven't been applied successfully
- Go back to step 3 and re-run the SQL statements
- Ensure you're logged into the correct Supabase project

## Additional Notes
- These policies allow each user to only update their own records (by `user_id`)
- Your existing profile policy for UPDATE was also missing and has been added
- The app code is now ready to handle proper edit/update flows
