import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const sections = [
  {
    id: 'help',
    title: '1. Getting Help — The Escalation Path',
    content: (
      <>
        <p className="mb-3">When something's not right, please follow this order so issues get resolved fast:</p>
        <ol className="list-decimal pl-6 space-y-2 mb-4">
          <li><strong>Check the FAQs / this guide first</strong> — most common questions are answered here</li>
          <li><strong>Ask your house captain</strong> — they handle day-to-day stuff and can often resolve things on the spot</li>
          <li><strong>Escalate to Hyve</strong> — if the house captain can't resolve it, raise a ticket on the tenant portal (<a href="https://lazybee.sg/portal" className="text-blue-600 underline">lazybee.sg/portal</a>) or WhatsApp us</li>
        </ol>
        <h4 className="font-semibold mt-4 mb-2">What counts as urgent?</h4>
        <p>Call or WhatsApp us directly (don't just raise a ticket) for:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Water leaks affecting the unit</li>
          <li>No power or water supply</li>
          <li>Gas leaks</li>
          <li>Broken locks / security issues</li>
          <li>Fire or safety risks</li>
        </ul>
      </>
    )
  },
  {
    id: 'portal',
    title: '2. Your Tenant Portal',
    content: (
      <>
        <p className="mb-3"><strong>Login:</strong> <a href="https://lazybee.sg/portal" className="text-blue-600 underline">lazybee.sg/portal</a></p>
        <p className="mb-2">Here you can:</p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>View and download your Tenancy Agreement</li>
          <li>Pay rent (PayNow or credit card)</li>
          <li>Raise maintenance tickets</li>
          <li>Check AC usage and overage charges</li>
          <li>Update your personal details</li>
        </ul>
        <p>If your portal shows rent as "pending" after you've paid, give it 1–2 working days to sync. If still wrong, WhatsApp us with your payment slip.</p>
      </>
    )
  },
  {
    id: 'rent',
    title: '3. Rent & Payments',
    content: (
      <>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li><strong>Due date:</strong> 5th of each month</li>
          <li><strong>Payment methods:</strong> PayNow (preferred, no fee) or credit card via portal (processing fee applies)</li>
          <li><strong>Late fee:</strong> $50 kicks in after the 10th</li>
          <li><strong>Security deposit:</strong> equivalent to one month's rent, held by Hyve</li>
        </ul>
        <h4 className="font-semibold mt-3 mb-1">Can I pay by credit card?</h4>
        <p className="mb-3">Yes — via the portal Stripe link. Processing fee applies.</p>
        <h4 className="font-semibold mt-3 mb-1">Why does my portal show rent as pending when I've paid?</h4>
        <p className="mb-3">Give it 1–2 working days to sync. If still wrong, send us your payment slip.</p>
        <h4 className="font-semibold mt-3 mb-1">Pro-rated rent</h4>
        <p>If you moved in partway through the month, your first month's rent is pro-rated to your actual move-in date.</p>
      </>
    )
  },
  {
    id: 'transfer',
    title: '4. Transfer of Tenancy (Moving Out Early)',
    content: (
      <>
        <p className="mb-3">If you need to leave before your lease ends, you can transfer your tenancy to a replacement. This avoids losing your deposit.</p>

        <h4 className="font-semibold mt-4 mb-1">What is a licence transfer?</h4>
        <p className="mb-3">You pass your remaining lease term to a new tenant who takes over the room on your existing terms.</p>

        <h4 className="font-semibold mt-4 mb-1">Who handles the transfer?</h4>
        <p className="mb-2"><strong>You (the outgoing tenant) handle the process — this is not delegated to Hyve.</strong></p>
        <p className="mb-1">Your responsibilities:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Source a suitable replacement yourself</li>
          <li>Introduce them to Hyve</li>
          <li>Answer their queries</li>
          <li>Have them review and agree to the Transfer of Tenancy Agreement (<a href="/docs/transfer-of-tenancy-sample.html" className="text-blue-600 underline" target="_blank" rel="noreferrer">sample here</a>)</li>
          <li>Coordinate the handover date</li>
          <li>Ensure the room is in good condition for handover</li>
        </ul>
        <p className="mb-1">Hyve only handles:</p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Issuing the updated licence to the incoming tenant</li>
          <li>Processing your deposit refund once the transfer is complete</li>
        </ul>

        <h4 className="font-semibold mt-4 mb-1">What are the terms for the new tenant?</h4>
        <p className="mb-3">The incoming tenant <strong>inherits your existing licence</strong> — same rent, same deposit, same remaining term, and all associated liabilities. <strong>No renegotiation.</strong></p>

        <h4 className="font-semibold mt-4 mb-1">When do I get my deposit back?</h4>
        <p className="mb-3">Refunded once the new tenant (1) signs the licence, (2) pays their deposit and first month's rent, and (3) officially moves in. Processed within <strong>7 working days</strong>.</p>

        <h4 className="font-semibold mt-4 mb-1">What gets deducted from my deposit?</h4>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Unpaid rent or utilities up to the <strong>takeover date</strong></li>
          <li>Damage beyond normal wear and tear</li>
          <li>Missing inventory</li>
          <li>Deep cleaning if required</li>
        </ul>

        <h4 className="font-semibold mt-4 mb-1">What if the new tenant chooses a different Hyve unit?</h4>
        <p className="mb-3">Your transfer is not completed and your deposit is not yet refundable. You still earn our <strong>$100 SGD referral bonus</strong> for bringing them to Hyve.</p>

        <h4 className="font-semibold mt-4 mb-1">What if they're moving in later than my exit date?</h4>
        <p className="mb-3"><strong>You remain on the hook for rent</strong> until the new tenant's takeover date. The licence is still in your name until the transfer is executed.</p>

        <h4 className="font-semibold mt-4 mb-1">What if I can't find a replacement?</h4>
        <p className="mb-3">Your deposit is forfeited per the early termination clause. You remain liable for rent until the room is re-let or your lease ends.</p>

        <h4 className="font-semibold mt-4 mb-1">Can I transfer to anyone?</h4>
        <p className="mb-3">The incoming tenant must pass Hyve's standard screening, commit to at least the remaining term, agree to house rules, and be compatible with housemates. Hyve has final approval.</p>

        <h4 className="font-semibold mt-4 mb-1">How does the referral bonus work?</h4>
        <p className="mb-3">Refer someone who signs a licence with Hyve → <strong>$100 SGD</strong> after they complete their first month. Applies whether or not they take over your specific room.</p>

        <h4 className="font-semibold mt-4 mb-1">Can my friend just replace me unofficially?</h4>
        <p>No. Unauthorised subletting = immediate termination.</p>
      </>
    )
  },
  {
    id: 'issues',
    title: '5. Issues & Maintenance',
    content: (
      <>
        <h4 className="font-semibold mb-1">How do I report an issue?</h4>
        <p className="mb-3">Follow the escalation path: docs → house captain → Hyve via portal or WhatsApp.</p>

        <h4 className="font-semibold mt-3 mb-1">How quickly will my issue be resolved?</h4>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li><strong>Urgent</strong> (safety, major leaks, no power/water): within 24 hours</li>
          <li><strong>Standard</strong> (appliance repairs, leaks, fixtures): 3–5 working days</li>
          <li><strong>Cosmetic:</strong> batched into monthly maintenance sweep</li>
        </ul>

        <h4 className="font-semibold mt-3 mb-1">Who pays for repairs?</h4>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li><strong>Hyve covers:</strong> normal wear and tear, appliance failures, landlord-responsibility items</li>
          <li><strong>You cover:</strong> repairs caused by misuse, negligence, or damage beyond normal use</li>
        </ul>

        <h4 className="font-semibold mt-3 mb-1">Pests</h4>
        <p className="mb-3">Report immediately via WhatsApp with photos. Prevention is shared — wash dishes, dispose of food properly, don't leave food out.</p>

        <h4 className="font-semibold mt-3 mb-1">Locked out?</h4>
        <p className="mb-3">WhatsApp us — we keep spare keys. After-hours call-outs may incur a service fee.</p>

        <h4 className="font-semibold mt-3 mb-1">Can I do small repairs myself?</h4>
        <p className="mb-3">Light bulbs and batteries — yes. Plumbing/electrical/appliances/structural — raise a ticket. Unauthorised repairs that cause damage will be charged to you.</p>

        <h4 className="font-semibold mt-3 mb-1">What if my housemates are the problem?</h4>
        <p>Try to resolve directly first. If that doesn't work, message your house captain or Hyve. We mediate and, in serious cases, enforce house rules.</p>
      </>
    )
  },
  {
    id: 'house-rules',
    title: '6. House Rules (Quick Reference)',
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>Keep common areas clean</li>
        <li>Respect noise levels (especially after 10 PM)</li>
        <li>No smoking indoors</li>
        <li>No parties without prior approval</li>
        <li>Overnight guests allowed with notice (limit 2–3 nights/week)</li>
        <li><strong>Cats are welcome</strong> (dogs: case by case)</li>
        <li>Wash your dishes — shared kitchens = shared responsibility</li>
      </ul>
    )
  },
  {
    id: 'condo-cards',
    title: '7. Condo Access Cards',
    content: (
      <>
        <h4 className="font-semibold mb-1">How do I renew my condo access card?</h4>
        <p className="mb-2">Take to the condo management office:</p>
        <ol className="list-decimal pl-6 space-y-1 mb-4">
          <li>Your current Tenancy Agreement (from the portal)</li>
          <li>Your IRAS stamping certificate</li>
        </ol>

        <h4 className="font-semibold mt-3 mb-1">Don't have a SG bank account / don't know what IRAS is?</h4>
        <p className="mb-3"><strong>We'll process IRAS e-stamping for you.</strong> WhatsApp us your passport, allow 2–3 working days.</p>

        <h4 className="font-semibold mt-3 mb-1">Where do I get my Tenancy Agreement?</h4>
        <p>Tenant portal → Documents section. If you have trouble, WhatsApp us.</p>
      </>
    )
  },
  {
    id: 'links',
    title: '8. Useful Links',
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Tenant portal:</strong> <a href="https://lazybee.sg/portal" className="text-blue-600 underline">lazybee.sg/portal</a></li>
        <li><strong>Public FAQs:</strong> <a href="/faqs" className="text-blue-600 underline">lazybee.sg/faqs</a></li>
        <li><strong>Transfer sample agreement:</strong> <a href="/docs/transfer-of-tenancy-sample.html" className="text-blue-600 underline" target="_blank" rel="noreferrer">lazybee.sg/docs/transfer-of-tenancy-sample.html</a></li>
        <li><strong>Email:</strong> <a href="mailto:admin@lazybee.sg" className="text-blue-600 underline">admin@lazybee.sg</a></li>
        <li><strong>WhatsApp:</strong> your house group, or message Hyve directly</li>
      </ul>
    )
  }
];

const ResidentGuidePage = () => {
  const [open, setOpen] = useState({});
  const toggle = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Hyve Resident Guide</h1>
          <p className="text-lg text-gray-600">Everything you need to know during your stay.</p>
          <p className="text-sm text-gray-400 mt-2">Last updated: 20 Apr 2026</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
          {sections.map(s => (
            <div key={s.id}>
              <button
                onClick={() => toggle(s.id)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 flex justify-between items-center"
              >
                <span className="font-semibold text-gray-900">{s.title}</span>
                {open[s.id] ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
              </button>
              {open[s.id] && (
                <div className="px-6 pb-6 text-gray-700">{s.content}</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          Questions? Email <a href="mailto:admin@lazybee.sg" className="text-blue-600 underline">admin@lazybee.sg</a>
        </div>
      </div>
    </div>
  );
};

export default ResidentGuidePage;
