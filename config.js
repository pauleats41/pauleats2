// ---- Fill these in from your Supabase project ----
// Dashboard → Project Settings → API → "Project URL" and "anon public" key.
// These two values are meant to be public (they go in client-side code) —
// your data stays protected by the Row Level Security policies from schema.sql,
// not by keeping this key secret.

const SUPABASE_URL = "https://ehswhfomqfyumfqrztxv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3doZm9tcWZ5dW1mcXJ6dHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNzIxNTAsImV4cCI6MjA5OTY0ODE1MH0.aLoCV3YoHhghOk8acbLuXSw_kj3vrqrGGNe_3KXCfAk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// NOTE: the homepage "Recent orders" section now pulls directly from your
// Telegram channel via the "telegram-feed" edge function (see SETUP.md) —
// it no longer uses this setting. SOCIAL_FEED_FUNCTION is unused for now;
// kept here in case you want a separate Instagram-based gallery again later.
const SOCIAL_FEED_FUNCTION = "";
