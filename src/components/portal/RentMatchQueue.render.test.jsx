// Render smoke test for the rent match review queue.
//
// Needs JSX, so like NeedsOutcomeTab.render.test.jsx this one runs on vitest
// rather than `node --test`. Not a devDependency; run it with:
//   npx vitest run src/components/portal/RentMatchQueue.render.test.jsx
//
// Scope, stated honestly: renderToStaticMarkup does not run effects, so this
// proves the component mounts and paints its initial state without throwing.
// The interactive confirm/dismiss path sits behind an admin login and is not
// covered here. The decision logic it displays is covered separately by the
// 19 tests in supabase/functions/_shared/rentMatch.test.js.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RentMatchQueue from "./RentMatchQueue";

describe("RentMatchQueue", () => {
  it("mounts and paints its loading state without throwing", () => {
    const html = renderToStaticMarkup(<RentMatchQueue onResolved={() => {}} />);
    expect(html).toContain("animate-pulse");
  });

  it("does not require an onResolved callback", () => {
    expect(() => renderToStaticMarkup(<RentMatchQueue />)).not.toThrow();
  });
});
