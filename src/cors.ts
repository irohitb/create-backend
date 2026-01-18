// Shared CORS headers for HTTP responses.
//
// We keep this as a plain object (Record<string, string>) rather than a
// `Headers` instance so it can be easily spread into other header objects.
// (See `src/json.ts` usage: `{ ...corsHeaders, "Content-Type": ... }`.)
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
