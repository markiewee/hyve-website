/**
 * useTransactionImport.js
 *
 * React hook that handles importing bank transactions from two sources:
 *   1. Aspire API  (importFromAspire)
 *   2. CSV file    (importFromCsv)
 *
 * Both paths:
 *   - Create an import_batches record
 *   - Load tagging_rules from Supabase
 *   - Auto-tag transactions via autoTagTransactions()
 *   - Insert into bank_transactions in chunks of 50
 *   - Update the batch with final stats
 *   - Return { batchId, total, autoTagged }
 */

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { autoTagTransactions } from '../lib/tagging';
import { aspire } from '../lib/aspire';

const CHUNK_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a date string that may be DD/MM/YYYY or YYYY-MM-DD into YYYY-MM-DD.
 *
 * @param {string} raw
 * @returns {string}
 */
function parseDateField(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Already ISO or close enough
  return trimmed;
}

/**
 * Map a raw CSV row (with Aspire-style column names) to our transaction schema.
 *
 * @param {Object} row  — papaparse header row
 * @returns {{ transaction_date: string, description: string, amount: number, currency: string, reference: string }}
 */
function mapCsvRow(row) {
  // Normalise header keys: trim whitespace, lowercase for matching
  const normalised = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v])
  );

  const rawDate =
    normalised['transaction date'] ??
    normalised['date'] ??
    '';

  const rawDescription =
    normalised['description'] ??
    normalised['narrative'] ??
    '';

  const rawAmount =
    normalised['amount (sgd)'] ??
    normalised['amount'] ??
    '0';

  const rawReference =
    normalised['reference'] ??
    '';

  const rawCurrency =
    normalised['currency'] ??
    'SGD';

  return {
    transaction_date: parseDateField(rawDate),
    description: String(rawDescription).trim(),
    // CSV exports typically have positive values for debits; we take Math.abs
    amount: Math.abs(parseFloat(String(rawAmount).replace(/[^0-9.\-]/g, '')) || 0),
    currency: String(rawCurrency).trim() || 'SGD',
    reference: String(rawReference).trim(),
  };
}

/**
 * Insert rows into bank_transactions in chunks of CHUNK_SIZE.
 * Reports progress after each chunk via the onProgress callback.
 *
 * @param {Array}    rows
 * @param {string}   batchId
 * @param {Function} onProgress  — called with (insertedSoFar, total)
 */
async function insertInChunks(rows, batchId, onProgress) {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map(row => ({
      ...row,
      import_batch_id: batchId,
    }));

    const { error } = await supabase.from('bank_transactions').insert(chunk);

    if (error) {
      throw new Error(`Failed to insert transactions (chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${error.message}`);
    }

    inserted += chunk.length;
    onProgress(inserted, rows.length);
  }

  return inserted;
}

/**
 * Fetch all tagging rules from Supabase.
 *
 * @returns {Promise<Array>}
 */
async function fetchTaggingRules() {
  const { data, error } = await supabase.from('tagging_rules').select('*');
  if (error) {
    console.warn('[useTransactionImport] Could not load tagging_rules:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Create an import_batches record and return its id.
 *
 * @param {{ source: string, filename?: string, account_id?: string }} meta
 * @returns {Promise<string>} batchId
 */
async function createBatch(meta) {
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      source: meta.source,
      filename: meta.filename ?? null,
      account_id: meta.account_id ?? null,
      status: 'processing',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create import batch: ${error.message}`);
  }

  return data.id;
}

/**
 * Finalise a batch record with total / auto_tagged counts.
 *
 * @param {string} batchId
 * @param {{ total: number, autoTagged: number }} stats
 */
async function finaliseBatch(batchId, stats) {
  const { error } = await supabase
    .from('import_batches')
    .update({
      status: 'complete',
      total_transactions: stats.total,
      auto_tagged_count: stats.autoTagged,
    })
    .eq('id', batchId);

  if (error) {
    // Non-fatal — log but don't throw
    console.error('[useTransactionImport] Failed to update batch stats:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @returns {{
 *   importFromAspire: (accountId: string, fromDate: string, toDate: string) => Promise<{ batchId: string, total: number, autoTagged: number }>,
 *   importFromCsv: (file: File) => Promise<{ batchId: string, total: number, autoTagged: number }>,
 *   importing: boolean,
 *   progress: { inserted: number, total: number },
 *   error: string | null,
 * }}
 */
export function useTransactionImport() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ inserted: 0, total: 0 });
  const [error, setError] = useState(null);

  const handleProgress = useCallback((inserted, total) => {
    setProgress({ inserted, total });
  }, []);

  // -------------------------------------------------------------------------
  // importFromAspire
  // -------------------------------------------------------------------------
  const importFromAspire = useCallback(async (accountId, fromDate, toDate) => {
    setImporting(true);
    setError(null);
    setProgress({ inserted: 0, total: 0 });

    try {
      // 1. Create batch record
      const batchId = await createBatch({ source: 'ASPIRE', account_id: accountId });

      // 2. Fetch transactions from Aspire API
      const rawTransactions = await aspire.getTransactions(accountId, {
        from_date: fromDate,
        to_date: toDate,
        per_page: 500,
      });

      if (rawTransactions.length === 0) {
        await finaliseBatch(batchId, { total: 0, autoTagged: 0 });
        return { batchId, total: 0, autoTagged: 0 };
      }

      setProgress({ inserted: 0, total: rawTransactions.length });

      // 3. Fetch tagging rules and auto-tag
      const rules = await fetchTaggingRules();
      const tagged = autoTagTransactions(rawTransactions, rules);
      const autoTagged = tagged.filter(t => t.status === 'AUTO_TAGGED').length;

      // 4. Insert in chunks
      await insertInChunks(tagged, batchId, handleProgress);

      // 5. Finalise batch
      await finaliseBatch(batchId, { total: tagged.length, autoTagged });

      return { batchId, total: tagged.length, autoTagged };
    } catch (err) {
      const msg = err?.message ?? 'Unknown error during Aspire import';
      setError(msg);
      throw err;
    } finally {
      setImporting(false);
    }
  }, [handleProgress]);

  // -------------------------------------------------------------------------
  // importFromCsv
  // -------------------------------------------------------------------------
  const importFromCsv = useCallback(async (file) => {
    setImporting(true);
    setError(null);
    setProgress({ inserted: 0, total: 0 });

    try {
      // 1. Parse CSV
      const rawRows = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            if (result.errors.length > 0) {
              // Non-fatal row-level errors — log and continue
              console.warn('[useTransactionImport] CSV parse warnings:', result.errors);
            }
            resolve(result.data);
          },
          error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
        });
      });

      if (rawRows.length === 0) {
        throw new Error('CSV file contains no data rows.');
      }

      // 2. Map to our schema
      const transactions = rawRows.map(mapCsvRow).filter(t => t.transaction_date);

      if (transactions.length === 0) {
        throw new Error('No valid transactions found in CSV. Check that the Date column is present and populated.');
      }

      setProgress({ inserted: 0, total: transactions.length });

      // 3. Create batch record
      const batchId = await createBatch({ source: 'CSV', filename: file.name });

      // 4. Fetch tagging rules and auto-tag
      const rules = await fetchTaggingRules();
      const tagged = autoTagTransactions(transactions, rules);
      const autoTagged = tagged.filter(t => t.status === 'AUTO_TAGGED').length;

      // 5. Insert in chunks
      await insertInChunks(tagged, batchId, handleProgress);

      // 6. Finalise batch
      await finaliseBatch(batchId, { total: tagged.length, autoTagged });

      return { batchId, total: tagged.length, autoTagged };
    } catch (err) {
      const msg = err?.message ?? 'Unknown error during CSV import';
      setError(msg);
      throw err;
    } finally {
      setImporting(false);
    }
  }, [handleProgress]);

  return { importFromAspire, importFromCsv, importing, progress, error };
}
