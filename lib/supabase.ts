import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mclnbxiwmoilpjczuwpy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbG5ieGl3bW9pbHBqY3p1d3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTQ2MTksImV4cCI6MjA5MzQ5MDYxOX0.9uGcwJQB5YaqM7_acKay8r7VI4q2pKbip2wezWp4M5w";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
