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
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'INCOME' | 'EXPENSE'

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

      if (typeFilter !== 'ALL') {
        query = query.eq('transaction_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [batchId, typeFilter]);

  const fetchProperties = useCallback(async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, code')
      .order('name', { ascending: true });
    if (error) throw error;
    setProperties(data ?? []);
  }, []);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, property_id')
      .order('name', { ascending: true });
    if (error) {
      console.warn('[useTransactionReview] Could not load rooms:', error.message);
      return;
    }
    setRooms(data ?? []);
  }, []);

  // Load on mount / when batchId or typeFilter changes
  useEffect(() => {
    fetchTransactions();
    fetchProperties();
    fetchRooms();
  }, [fetchTransactions, fetchProperties, fetchRooms]);

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
   * @param {{ room_id?: string, transaction_type?: string }} extra — Optional extra fields.
   */
  const confirmTag = useCallback(async (transactionId, propertyId, category, month = null, extra = {}) => {
    // a) Update the transaction row
    const updatePayload = {
      property_id: propertyId,
      category,
      status: 'CONFIRMED',
      confidence: 1.0,
    };
    if (extra.transaction_type) updatePayload.transaction_type = extra.transaction_type;
    if (extra.room_id) updatePayload.room_id = extra.room_id;

    const { data: updatedRows, error: updateError } = await supabase
      .from('bank_transactions')
      .update(updatePayload)
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) throw updateError;
    const tx = updatedRows;

    // b) Upsert tagging_rules — select-then-insert/update to handle nullable property_id
    const vendorPattern = extractVendorPattern(tx.description);
    const txType = tx.transaction_type ?? (tx.amount >= 0 ? 'INCOME' : 'EXPENSE');

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
            transaction_type: txType,
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
            transaction_type: txType,
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

  /**
   * Assign a room to a transaction.
   *
   * @param {string} transactionId
   * @param {string|null} roomId
   */
  const assignRoom = useCallback(async (transactionId, roomId) => {
    const { error } = await supabase
      .from('bank_transactions')
      .update({ room_id: roomId || null })
      .eq('id', transactionId);
    if (error) throw error;
    await fetchTransactions();
  }, [fetchTransactions]);

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    transactions,
    properties,
    rooms,
    loading,
    stats,
    typeFilter,
    setTypeFilter,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    assignRoom,
    refresh: fetchTransactions,
  };
}
