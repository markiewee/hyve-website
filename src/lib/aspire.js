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

class AspireClient {
  constructor() {
    this.token = null;
    this.tokenExpiry = null; // timestamp (ms)
  }

  /**
   * POST /login with client_credentials, cache the returned access_token.
   * Sets tokenExpiry based on expires_in (seconds), defaulting to 3600 s.
   */
  async authenticate() {
    const clientId = import.meta.env.VITE_ASPIRE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_ASPIRE_API_KEY;

    if (!clientId || !apiKey) {
      throw new Error(
        'Aspire credentials missing. Set VITE_ASPIRE_CLIENT_ID and VITE_ASPIRE_API_KEY in your .env file.'
      );
    }

    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: apiKey,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aspire auth failed (${res.status}): ${body}`);
    }

    const data = await res.json();

    if (!data.access_token) {
      throw new Error(`Aspire auth response missing access_token. Response: ${JSON.stringify(data)}`);
    }

    this.token = data.access_token;
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    this.tokenExpiry = Date.now() + expiresIn * 1000;

    return this.token;
  }

  /**
   * Return the cached token, re-authenticating if it has expired (or is
   * within EXPIRY_BUFFER_MS of expiry).
   */
  async getToken() {
    if (!this.token || Date.now() >= (this.tokenExpiry ?? 0) - EXPIRY_BUFFER_MS) {
      await this.authenticate();
    }
    return this.token;
  }

  /**
   * Authenticated fetch wrapper.
   *
   * @param {'GET'|'POST'|'PATCH'|'DELETE'} method
   * @param {string} path  — path relative to BASE_URL, e.g. '/accounts'
   * @param {{ params?: Object, body?: Object }} options
   * @returns {Promise<any>} parsed JSON response
   */
  async request(method, path, options = {}) {
    const token = await this.getToken();

    let url = `${BASE_URL}${path}`;

    if (options.params && Object.keys(options.params).length > 0) {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(options.params).filter(([, v]) => v !== undefined && v !== null)
        )
      );
      url += `?${qs.toString()}`;
    }

    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aspire API error ${res.status} ${method} ${path}: ${body}`);
    }

    return res.json();
  }

  /**
   * GET /accounts
   * Returns the raw accounts array from the API.
   */
  async getAccounts() {
    const data = await this.request('GET', '/accounts');

    // Log structure on first call to aid debugging
    console.debug('[AspireClient] getAccounts response shape:', {
      keys: Object.keys(data),
      sample: Array.isArray(data) ? data[0] : (data.data ?? data.accounts ?? data)[0],
    });

    // Aspire may wrap in { data: [...] } or { accounts: [...] } or return array directly
    return Array.isArray(data) ? data : (data.data ?? data.accounts ?? []);
  }

  /**
   * GET /accounts/{accountId}/transactions
   * Falls back to GET /transactions if the first call returns a 404.
   *
   * @param {string} accountId
   * @param {{ from_date?: string, to_date?: string, page?: number, per_page?: number }} params
   * @returns {Promise<Array<{ transaction_date, description, amount, currency, reference }>>}
   */
  async getTransactions(accountId, params = {}) {
    let raw;

    try {
      raw = await this.request('GET', `/accounts/${accountId}/transactions`, { params });
    } catch (err) {
      // If the account-scoped endpoint doesn't exist, try the flat /transactions endpoint
      if (err.message.includes('404')) {
        console.warn(
          '[AspireClient] /accounts/{id}/transactions returned 404, falling back to /transactions'
        );
        raw = await this.request('GET', '/transactions', { params: { ...params, account_id: accountId } });
      } else {
        throw err;
      }
    }

    // Log structure on first call so the developer can verify field names
    console.debug('[AspireClient] getTransactions raw response shape:', {
      keys: Object.keys(raw),
      sampleItem: Array.isArray(raw)
        ? raw[0]
        : (raw.data ?? raw.transactions ?? raw)[0],
    });

    // Unwrap common envelope patterns
    const items = Array.isArray(raw)
      ? raw
      : (raw.data ?? raw.transactions ?? raw.items ?? []);

    return items.map(normalizeTransaction);
  }
}

export const aspire = new AspireClient();
