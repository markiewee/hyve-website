import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const CLAIM_COLUMNS = `
  id, submitted_by, property_id, category, amount_sgd, description,
  receipt_url, item_url, status, admin_comment, payment_reference,
  created_at, reviewed_at, reviewed_by, paid_at,
  properties(name)
`;

// claims bucket only allows image/jpeg|png|heic|webp. Android galleries often
// give an empty file.type, which the bucket rejects (415). Derive the MIME from
// the (already validated) extension so the upload always carries a valid type.
const EXT_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" };

async function uploadClaimPhoto(file, userId, kind) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "heic", "webp"].includes(ext) ? ext : "jpg";
  const path = `${userId}/${Date.now()}_${kind}.${safeExt}`;

  // supabase-js takes the multipart content-type from the Blob's own .type and
  // ignores the `contentType` option for File bodies. Re-wrap when the type is
  // missing (common on Android) so the image-only bucket doesn't 415.
  const typed =
    file.type && file.type.startsWith("image/")
      ? file
      : new File([file], file.name, { type: EXT_MIME[safeExt] });

  const { error } = await supabase.storage.from("claims").upload(path, typed, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function useClaims({ scope = "own", filter } = {}) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("claims")
      .select(CLAIM_COLUMNS)
      .order("created_at", { ascending: false });

    if (scope === "own") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setClaims([]);
        setLoading(false);
        return;
      }
      query = query.eq("submitted_by", user.id);
    }
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);
    if (filter?.captainId) query = query.eq("submitted_by", filter.captainId);

    const { data, error: err } = await query;
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    setClaims(data ?? []);
    setError(null);
    setLoading(false);
  }, [scope, filter?.status, filter?.propertyId, filter?.captainId]);

  useEffect(() => {
    if (scope === "none") {
      setLoading(false);
      return;
    }
    fetchClaims();
  }, [fetchClaims, scope]);

  const submitClaim = useCallback(async ({
    propertyId, category, amount, description, receiptFile, itemFile,
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");

    const receiptPath = await uploadClaimPhoto(receiptFile, user.id, "receipt");
    const itemPath = await uploadClaimPhoto(itemFile, user.id, "item");

    const { data, error: err } = await supabase
      .from("claims")
      .insert({
        submitted_by: user.id,
        property_id: propertyId,
        category,
        amount_sgd: amount,
        description,
        receipt_url: receiptPath,
        item_url: itemPath,
      })
      .select(CLAIM_COLUMNS)
      .single();

    if (err) throw err;
    await fetchClaims();
    return data;
  }, [fetchClaims]);

  const reviewClaim = useCallback(async (claimId, { status, comment }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("claims")
      .update({
        status,
        admin_comment: comment ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", claimId);
    if (err) throw err;
    await fetchClaims();
  }, [fetchClaims]);

  const markPaid = useCallback(async (claimId, paymentReference) => {
    const { error: err } = await supabase
      .from("claims")
      .update({
        status: "PAID",
        payment_reference: paymentReference,
        paid_at: new Date().toISOString(),
      })
      .eq("id", claimId);
    if (err) throw err;
    await fetchClaims();
  }, [fetchClaims]);

  const getSignedUrl = useCallback(async (path) => {
    const { data, error: err } = await supabase.storage
      .from("claims")
      .createSignedUrl(path, 60 * 60);
    if (err) throw err;
    return data.signedUrl;
  }, []);

  return { claims, loading, error, submitClaim, reviewClaim, markPaid, getSignedUrl, refetch: fetchClaims };
}
