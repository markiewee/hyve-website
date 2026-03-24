import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { useState, useEffect } from "react";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });
}

export default function SigningConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [signedAt, setSignedAt] = useState(location.state?.signedAt ?? null);
  const [onboardingId, setOnboardingId] = useState(location.state?.onboardingId ?? null);
  const [signedPdfUrl, setSignedPdfUrl] = useState(null);
  const [loading, setLoading] = useState(!location.state);
  const [downloading, setDownloading] = useState(false);

  // If no route state, fetch from supabase
  useEffect(() => {
    if (signedAt && onboardingId) return;

    async function fetchOnboarding() {
      try {
        const onboarding = profile?.onboarding_progress;
        if (onboarding) {
          setSignedAt(onboarding.ta_signed_at ?? new Date().toISOString());
          setOnboardingId(onboarding.id);
        } else {
          // Fallback: query directly
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data } = await supabase
            .from("onboarding_progress")
            .select("id, ta_signed_at, ta_signed_url")
            .eq("user_id", user.id)
            .single();

          if (data) {
            setSignedAt(data.ta_signed_at ?? new Date().toISOString());
            setOnboardingId(data.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch onboarding:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOnboarding();
  }, [signedAt, onboardingId, profile]);

  // Fetch signed PDF URL
  useEffect(() => {
    async function fetchSignedPdf() {
      const onboarding = profile?.onboarding_progress;
      const path = onboarding?.ta_signed_url;
      if (!path) return;

      if (path.startsWith("http")) {
        setSignedPdfUrl(path);
        return;
      }

      const { data, error } = await supabase.storage
        .from("tenant-documents")
        .createSignedUrl(path, 3600);

      if (!error && data?.signedUrl) {
        setSignedPdfUrl(data.signedUrl);
      }
    }

    fetchSignedPdf();
  }, [profile]);

  function handleDownloadPdf() {
    if (!signedPdfUrl) return;
    setDownloading(true);
    window.open(signedPdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setDownloading(false), 1000);
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5f]" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        {/* Animated checkmark */}
        <div className="mx-auto mb-8 w-24 h-24 rounded-full bg-green-50 flex items-center justify-center checkmark-container">
          <svg
            className="w-14 h-14 text-green-500 checkmark-svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              className="checkmark-circle"
              strokeLinecap="round"
            />
            <path
              d="M8 12.5l2.5 2.5 5-5"
              className="checkmark-tick"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#006b5f] mb-2">
          Agreement Signed Successfully
        </h1>
        <p className="font-['Manrope'] text-sm text-[#6c7a77] mb-6">
          Your Tenancy Agreement has been submitted. Thank you for signing!
        </p>

        {/* Signing timestamp */}
        {signedAt && (
          <div className="inline-flex items-center gap-2 bg-white border border-[#bbcac6]/30 rounded-lg px-4 py-2.5 mb-6">
            <svg className="w-4 h-4 text-[#6c7a77]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-['Manrope'] text-sm text-[#121c2a]">
              Signed on {formatDateTime(signedAt)}
            </span>
          </div>
        )}

        {/* Counter-signature status badge */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8">
          <div className="flex items-center justify-center gap-3">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <p className="font-['Manrope'] text-sm font-medium text-amber-800">
              Waiting for admin counter-signature
            </p>
          </div>
          <p className="font-['Manrope'] text-xs text-amber-700 mt-1.5">
            The Hyve team will countersign your agreement shortly. You'll receive an email once it's fully executed.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {signedPdfUrl && (
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full sm:w-auto font-['Manrope'] gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {downloading ? "Opening…" : "Preview Signed PDF"}
            </Button>
          )}

          <Button
            onClick={() => navigate("/portal/onboarding")}
            className="w-full sm:w-auto font-['Manrope'] bg-[#006b5f] hover:bg-[#005a50] gap-2"
          >
            Continue to Onboarding
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </div>

      {/* CSS animation for checkmark */}
      <style>{`
        .checkmark-circle {
          stroke-dasharray: 63;
          stroke-dashoffset: 63;
          animation: checkmark-circle-draw 0.6s ease-out 0.2s forwards;
          fill: none;
          stroke: currentColor;
        }
        .checkmark-tick {
          stroke-dasharray: 20;
          stroke-dashoffset: 20;
          animation: checkmark-tick-draw 0.4s ease-out 0.7s forwards;
          fill: none;
          stroke: currentColor;
        }
        .checkmark-container {
          animation: checkmark-pop 0.4s ease-out 0.1s both;
        }
        @keyframes checkmark-circle-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes checkmark-tick-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes checkmark-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </PortalLayout>
  );
}
