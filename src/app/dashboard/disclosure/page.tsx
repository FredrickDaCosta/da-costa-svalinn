
"use client";

import { Onboarding } from "@/components/onboarding";

/**
 * Re-disclosure page for compliance review.
 * Allows users to re-read and re-validate background sentry permissions.
 */
export default function DisclosurePreviewPage() {
  return <Onboarding isPreview={true} />;
}
