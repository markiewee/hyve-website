/**
 * aspire.js — Aspire API client with token lifecycle management.
 *
 * Credentials are read from:
 *   VITE_ASPIRE_CLIENT_ID
 *   VITE_ASPIRE_API_KEY
 *
 * The Aspire public API base URL is https://api.aspireapp.com/public/v1
 * Auth uses client_credentials flow (POST /login).
 */

const BASE_URL = 'https://api.aspireapp.com/public/v1';

// Token expiry buffer: re-auth 60 s before actual expiry
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Parse a DD/MM/YYYY date string into a YYYY-MM-DD ISO string.
 * Falls through for strings already in ISO format or unrecognised patterns.
 *
 * @param {string} raw
 * @returns {string}
 */
function parseDateToIso(raw) {
  if (!raw) return raw;
  // DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

/**
 * Normalise a raw Aspire transaction object into our internal schema.
 *
 * Aspire may use different field names across API versions — we try a set
 * of known aliases so we remain resilient to minor API changes.
 *
 * @param {Object} raw
 * @returns {{ transaction_date: string, description: string, amount: number, currency: string, reference: string }}
 */
function normalizeTransaction(raw) {
  const transaction_date = parseDateToIso(
    raw.transaction_date ?? raw.date ?? raw.value_date ?? raw.created_at ?? ''
  );

  const description =
    raw.description ?? raw.narrative ?? raw.merchant_name ?? raw.remarks ?? '';

  // Aspire amounts may be signed; we preserve the sign (debit = negative).
  const amount = typeof raw.amount === 'number'
    ? raw.amount
    : parseFloat(raw.amount ?? raw.amount_sgd ?? 0);

  const currency = raw.currency ?? raw.currency_code ?? 'SGD';

  const reference =
    raw.reference ?? raw.transaction_reference ?? raw.ref ?? raw.id ?? '';

  return { transaction_date, description, amount, currency, reference };
}

/**
 * Aspire API client — proxied through /api/portal/admin-actions to avoid CORS.
 * All calls go through the server-side proxy which handles auth.
 */
class AspireClient {
  async _proxy(aspire_action, params = {}) {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/portal/admin-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'aspire', aspire_action, ...params }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(body.error || `Aspire proxy error ${res.status}`);
    }
    return res.json();
  }

  async getAccounts() {
    const data = await this._proxy('accounts');
    return Array.isArray(data) ? data : (data.data ?? data.accounts ?? []);
  }

  async getTransactions(accountId, params = {}) {
    const raw = await this._proxy('transactions', {
      account_id: accountId,
      from_date: params.from_date,
      to_date: params.to_date,
      page: params.page,
      per_page: params.per_page,
    });
    const items = Array.isArray(raw) ? raw : (raw.data ?? raw.transactions ?? raw.items ?? []);
    return items.map(normalizeTransaction);
  }
}

export const aspire = new AspireClient();
