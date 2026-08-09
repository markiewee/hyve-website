// Render smoke test for the "Needs outcome" queue.
//
// Needs JSX, so unlike the plain node --test files in src/lib this one runs on
// vitest. It is not a devDependency; run it from the repo root with:
//   npx vitest run src/pages/portal/NeedsOutcomeTab.render.test.jsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NeedsOutcomeTab } from "./AdminViewingsPage.jsx";

const noop = async () => {};

describe("NeedsOutcomeTab", () => {
  it("paints the all-clear state when nothing is pending", () => {
    const html = renderToStaticMarkup(<NeedsOutcomeTab viewings={[]} refetch={noop} />);
    expect(html).toContain("Every past viewing is closed out");
  });

  it("lists a past unanswered viewing with its three answers", () => {
    const viewings = [
      {
        id: "v1",
        prospect_name: "Chiara",
        status: "confirmed",
        completed_at: null,
        slot_start: "2026-08-01T11:00:00+08:00",
        properties: { name: "Chiltern Park" },
        rooms: { unit_code: "CP-PR3" },
      },
    ];
    const html = renderToStaticMarkup(<NeedsOutcomeTab viewings={viewings} refetch={noop} />);
    expect(html).toContain("Chiara");
    expect(html).toContain("CP-PR3");
    expect(html).toContain("Attended");
    expect(html).toContain("No show");
    expect(html).toContain("Cancelled");
    expect(html).toContain("<strong>1</strong>");
  });

  it("flags anything a week or more overdue", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
    const html = renderToStaticMarkup(
      <NeedsOutcomeTab
        viewings={[{ id: "v2", prospect_name: "Tay", status: "pending", slot_start: eightDaysAgo }]}
        refetch={noop}
      />
    );
    expect(html).toContain("8 days overdue");
  });

  it("does not list a viewing that is already answered", () => {
    const html = renderToStaticMarkup(
      <NeedsOutcomeTab
        viewings={[
          {
            id: "v3",
            prospect_name: "Pedro",
            status: "attended",
            completed_at: "2026-08-02T10:00:00+08:00",
            slot_start: "2026-08-01T11:00:00+08:00",
          },
        ]}
        refetch={noop}
      />
    );
    expect(html).toContain("Every past viewing is closed out");
    expect(html).not.toContain("Pedro");
  });
});
