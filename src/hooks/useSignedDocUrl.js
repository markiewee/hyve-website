import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { signTenantDoc, storagePathFrom } from "../lib/idDocuments";

/**
 * A fresh signed url for a stored tenant document, made when it renders.
 *
 * The tenant-documents bucket is private, so whatever sits in the column
 * (a bare path on new rows, an old public or signed url on older ones) is
 * never shown directly. Returns { url, failed, loading }.
 */
export function useSignedDocUrl(value, expiresIn = 3600) {
  const [state, setState] = useState({ key: null, url: null, failed: false });
  const path = storagePathFrom(value);

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    signTenantDoc(supabase, path, expiresIn).then((url) => {
      if (!cancelled) setState({ key: path, url, failed: !url });
    });
    return () => {
      cancelled = true;
    };
  }, [path, expiresIn]);

  if (!path) return { url: null, failed: false, loading: false };
  if (state.key !== path) return { url: null, failed: false, loading: true };
  return { url: state.url, failed: state.failed, loading: false };
}
