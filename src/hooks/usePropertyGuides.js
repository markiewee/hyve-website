import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function usePropertyGuides(propertyId) {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data, error } = await supabase
        .from("property_guides")
        .select("*")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching property guides:", error);
      } else {
        setGuides(data ?? []);
      }
      setLoading(false);
    }

    fetch();
  }, [propertyId]);

  const getSection = (section) => guides.find((g) => g.section === section);
  const getSections = (prefix) => guides.filter((g) => g.section.startsWith(prefix));

  return { guides, loading, getSection, getSections };
}
