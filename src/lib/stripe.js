// Client-side: just the publishable key for redirects
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Stripe invoice payment links are generated server-side (Supabase edge function)
// Client just displays the hosted_invoice_url from ac_monthly_usage
