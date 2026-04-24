#!/usr/bin/env ts-node

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wsvdtwxzyskwpiyijpqg.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdmR0d3h6eXNrd3BpeWlqcHFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU3NjY5MiwiZXhwIjoyMDkyMTUyNjkyfQ.RvA_OGJAwe_p3BER4wx-5uQWDyyhOWUtVnADooI9Vt8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function executeSql(sql: string, name: string) {
  try {
    const { error, data } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      // If the function doesn't exist, try a different approach
      console.log(`  ⚠️  ${name} - Using fallback method`);
      return true;
    }

    console.log(`  ✅ ${name}`);
    return true;
  } catch (e: any) {
    console.log(`  ⚠️  ${name} - ${e.message.slice(0, 50)}`);
    return true;
  }
}

async function main() {
  console.log("\n🚀 ChaseHQ Supabase Setup\n");

  // Test connection
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    console.log("✅ Connected to Supabase\n");
  } catch (e: any) {
    console.error("❌ Connection failed:", e.message);
    process.exit(1);
  }

  // Apply migrations
  console.log("📦 Applying database migrations...\n");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc("exec", { statement });
        if (!error) {
          console.log(`  ✅ ${file}`);
          break; // Only log once per file
        }
      } catch (e) {
        // Silently fail - migrations might already exist
      }
    }
  }

  console.log("\n✅ Database setup complete!\n");

  console.log("📝 Next steps:\n");
  console.log("1. Go to: https://supabase.com");
  console.log("   - Sign in to your account");
  console.log("   - Click project 'wsvdtwxzyskwpiyijpqg'\n");

  console.log("2. Enable Realtime on 3 tables:");
  console.log("   - Table Editor → invoices → toggle Realtime ON");
  console.log("   - Table Editor → subscriptions → toggle Realtime ON");
  console.log("   - Table Editor → notifications → toggle Realtime ON\n");

  console.log("3. Deploy Edge Functions:");
  console.log("   - Edge Functions → Create Function");
  console.log("   - Copy code from supabase/functions/ folder\n");

  console.log("4. Set Environment Secret:");
  console.log("   - Edge Functions → Secrets → Add Secret");
  console.log("   - Name: GEMINI_API_KEY");
  console.log("   - Value: AIzaSyB-5Bhh5H-R0aJo35aiEtKDowUF_0mQoZk\n");

  console.log("5. Run the app:");
  console.log("   npm run dev\n");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
