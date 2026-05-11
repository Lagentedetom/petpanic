import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Single source of CORS headers, applied to EVERY response (success + error).
// Without this, the React client at app.petpanic.es sees "Failed to fetch" on
// any 401/500 path because the browser blocks the response for missing
// Access-Control-Allow-Origin. Fixes CR-05 from REVIEW.md.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "No autorizado" });
    }

    // User-context client uses the ANON key + the user's JWT — RLS-safe.
    // Previously this used the service-role key, which bypassed RLS for the
    // verification step (still worked because we only call auth.getUser, but
    // it was misleading and fragile if someone added DB calls here later).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return json(401, { error: "No autorizado" });
    }

    // Use service role to delete the user (cascades to profiles, pets, etc.)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return json(500, { error: "Error al eliminar la cuenta" });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("Error:", err);
    return json(500, { error: "Error interno" });
  }
});
