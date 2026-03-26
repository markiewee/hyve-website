import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { extractVendorPattern } from '../lib/tagging';

/**
 * useTransactionReview — Manages the review flow for bank transactions.
 *
 * @param {string|null} batchId — Optional import batch ID to filter transactions.
 */
export function useTransactionReview(batchId) {
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (batchId) {
        query = query.eq('import_batch_id', batchId);
      } else {
        query = query.in('status', ['PENDING', 'AUTO_TAGGED']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const fetchProperties = useCallback(async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, code')
      .order('name', { ascending: true });
    if (error) throw error;
    setProperties(data ?? []);
  }, []);

  // Load on mount / when batchId changes
  useEffect(() => {
    fetchTransactions();
    fetchProperties();
  }, [fetchTransactions, fetchProperties]);

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    pending: transactions.filter(t => t.status === 'PENDING').length,
    autoTagged: transactions.filter(t => t.status === 'AUTO_TAGGED').length,
    confirmed: transactions.filter(t => t.status === 'CONFIRMED').length,
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Confirm a tag for a transaction.
   * a) Updates bank_transactions row.
   * b) Upserts tagging_rules (select-then-insert/update to handle nullable property_id).
   * c) Inserts into property_expenses.
   * d) Refreshes the transaction list.
   *
   * @param {string} transactionId
   * @param {string} propertyId
   * @param {string} category
   * @param {string|null} month — Optional. If not provided, derived from transaction_date.
   */
  const confirmTag = useCallback(async (transactionId, propertyId, category, month = null) => {
    // a) Update the transaction row
    const { data: updatedRows, error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        property_id: propertyId,
        category,
        status: 'CONFIRMED',
        confidence: 1.0,
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) throw updateError;
    const tx = updatedRows;

    // b) Upsert tagging_rules — select-then-insert/update to handle nullable property_id
    const vendorPattern = extractVendorPattern(tx.description);

    if (vendorPattern) {
      let existingRuleQuery = supabase
        .from('tagging_rules')
        .select('id, hit_count')
        .eq('vendor_pattern', vendorPattern)
        .eq('category', category);

      // property_id can be null; use .is() for null checks, .eq() for non-null
      if (propertyId == null) {
        existingRuleQuery = existingRuleQuery.is('property_id', null);
      } else {
        existingRuleQuery = existingRuleQuery.eq('property_id', propertyId);
      }

      const { data: existingRules, error: selectError } = await existingRuleQuery;
      if (selectError) throw selectError;

      if (existingRules && existingRules.length > 0) {
        // Rule exists — increment hit_count and update last_used_at
        const rule = existingRules[0];
        const { error: ruleUpdateError } = await supabase
          .from('tagging_rules')
          .update({
            hit_count: (rule.hit_count ?? 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', rule.id);
        if (ruleUpdateError) throw ruleUpdateError;
      } else {
        // Rule does not exist — insert new rule
        const { error: ruleInsertError } = await supabase
          .from('tagging_rules')
          .insert({
            vendor_pattern: vendorPattern,
            property_id: propertyId ?? null,
            category,
            hit_count: 1,
            last_used_at: new Date().toISOString(),
          });
        if (ruleInsertError) throw ruleInsertError;
      }
    }

    // c) Insert into property_expenses
    // Derive month from transaction_date if not provided
    const expenseMonth = month
      ? month
      : tx.transaction_date
        ? tx.transaction_date.slice(0, 7) + '-01'
        : null;

    const { error: expenseError } = await supabase
      .from('property_expenses')
      .insert({
        property_id: propertyId,
        month: expenseMonth,
        category,
        description: tx.description,
        amount: tx.amount,
        is_recurring: false,
      });
    if (expenseError) throw expenseError;

    // d) Refresh transactions
    await fetchTransactions();
  }, [fetchTransactions]);

  /**
   * Mark a transaction as IGNORED and refresh.
   *
   * @param {string} transactionId
   */
  const ignoreTransaction = useCallback(async (transactionId) => {
    const { error } = await supabase
      .from('bank_transactions')
      .update({ status: 'IGNORED' })
      .eq('id', transactionId);
    if (error) throw error;
    await fetchTransactions();
  }, [fetchTransactions]);

  /**
   * Bulk-confirm all AUTO_TAGGED transactions with confidence >= minConfidence
   * that already have property_id and category set.
   *
   * @param {number} minConfidence — Default 0.85
   */
  const bulkConfirmAutoTagged = useCallback(async (minConfidence = 0.85) => {
    const eligible = transactions.filter(
      t =>
        t.status === 'AUTO_TAGGED' &&
        t.confidence >= minConfidence &&
        t.property_id != null &&
        t.category != null,
    );

    for (const tx of eligible) {
      // eslint-disable-next-line no-await-in-loop
      await confirmTag(tx.id, tx.property_id, tx.category, null);
    }

    // confirmTag already calls fetchTransactions after each — do a final refresh
    // to ensure state is consistent after the loop
    await fetchTransactions();
  }, [transactions, confirmTag, fetchTransactions]);

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    transactions,
    properties,
    loading,
    stats,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    refresh: fetchTransactions,
  };
}
