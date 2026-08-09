// src/lib/ownerModel.js
//
// The money model behind the owner homepage, ported verbatim from the script block
// of design-preview/owners.html.
//
// EVERY CONSTANT IN THIS FILE IS AN ASSUMPTION MARK HAS NOT YET CONFIRMED.
// They are all here, in one file, on purpose: when he confirms or corrects a number
// this is the only file that changes and every figure on the page moves with it.
// Do not inline any of these into a component, and do not "tidy" a number.
//
// No imports, no DOM, no React. That keeps it testable with node --test, which
// matters because the arithmetic is the part a visitor is asked to believe.

/* ── the money model ─────────────────────────────────────────────────
   Every constant is an assumption Mark has to confirm before this page
   is allowed anywhere near a real owner.
   ----------------------------------------------------------------- */
export const UPLIFT = 1.70;   // gross room income against whole-unit rent. Our own three homes run 1.73
export const OPEX = 0.26;     // furnishing amortised, utilities, wifi, cleaning, repairs, captain, management
export const FLOORPCT = 0.92; // the floor, as a share of market rent, paid full or empty
export const SHARE = 0.50;    // owner's cut of everything above the floor and the costs
export const VOIDMO = 0.75, AGENTMO = 0.5, REPAIRS = 0.02;  // what a fixed lease quietly costs over a year
export const SEASON = [0.96, 1.00, 1.03, 1.01, 0.95, 0.90, 1.04, 1.09, 1.03, 0.99, 0.95, 0.85];
export const VOID_MONTH = 11;
export const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/* indicative asking rents, S$ per square foot per month, by district.
   PLACEHOLDER: replace with a real feed before launch. */
export const PSF = {
  D01: 6.2, D02: 6.0, D03: 5.4, D04: 5.3, D05: 4.6, D06: 5.9, D07: 5.6, D08: 5.2, D09: 6.0, D10: 5.5,
  D11: 5.3, D12: 4.9, D13: 4.7, D14: 4.5, D15: 4.9, D16: 4.3, D17: 3.9, D18: 4.1, D19: 4.4, D20: 4.6,
  D21: 4.6, D22: 4.3, D23: 4.1, D24: 3.7, D25: 3.8, D26: 4.0, D27: 3.9, D28: 4.0,
};

/** First two digits of a Singapore postal code to postal district. */
export const SECTOR = {
  '01': 'D01', '02': 'D01', '03': 'D01', '04': 'D01', '05': 'D01', '06': 'D01', '07': 'D02', '08': 'D02',
  '14': 'D03', '15': 'D03', '16': 'D03', '09': 'D04', '10': 'D04', '11': 'D05', '12': 'D05', '13': 'D05',
  '17': 'D06', '18': 'D07', '19': 'D07', '20': 'D08', '21': 'D08', '22': 'D09', '23': 'D09', '24': 'D10',
  '25': 'D10', '26': 'D10', '27': 'D10', '28': 'D11', '29': 'D11', '30': 'D11', '31': 'D12', '32': 'D12',
  '33': 'D12', '34': 'D13', '35': 'D13', '36': 'D13', '37': 'D13', '38': 'D14', '39': 'D14', '40': 'D14',
  '41': 'D14', '42': 'D15', '43': 'D15', '44': 'D15', '45': 'D15', '46': 'D16', '47': 'D16', '48': 'D16',
  '49': 'D17', '50': 'D17', '81': 'D17', '51': 'D18', '52': 'D18', '53': 'D19', '54': 'D19', '55': 'D19',
  '82': 'D19', '56': 'D20', '57': 'D20', '58': 'D21', '59': 'D21', '60': 'D22', '61': 'D22', '62': 'D22',
  '63': 'D22', '64': 'D22', '65': 'D23', '66': 'D23', '67': 'D23', '68': 'D23', '69': 'D24', '70': 'D24',
  '71': 'D24', '72': 'D25', '73': 'D25', '77': 'D26', '78': 'D26', '75': 'D27', '76': 'D27', '79': 'D28',
  '80': 'D28',
};

/** District to the name an owner would actually use for it. */
export const DI = {
  D01: 'Raffles Place', D02: 'Tanjong Pagar', D03: 'Tiong Bahru', D04: 'Harbourfront', D05: 'West Coast',
  D06: 'Clarke Quay', D07: 'Bugis', D08: 'Farrer Park', D09: 'River Valley', D10: 'Holland', D11: 'Novena',
  D12: 'Toa Payoh', D13: 'Potong Pasir', D14: 'Paya Lebar', D15: 'Katong', D16: 'Bedok', D17: 'Loyang',
  D18: 'Tampines', D19: 'Serangoon', D20: 'Bishan', D21: 'Upper Bukit Timah', D22: 'Jurong',
  D23: 'Bukit Batok', D24: 'Tengah', D25: 'Woodlands', D26: 'Upper Thomson', D27: 'Yishun',
  D28: 'Yio Chu Kang',
};

/** What the hero starts on before anyone types a postal code. */
export const DEFAULT_STATE = { psf: 4.4, sqft: 900, beds: 3, district: 'D19' };

export const sgd = (n) => 'S$' + Math.round(n).toLocaleString('en-SG');

/** '556114' to 'D19'. Returns null until there are two digits to read. */
export function districtForPostal(value) {
  const v = String(value || '').replace(/\D/g, '').slice(0, 6);
  return v.length >= 2 ? SECTOR[v.slice(0, 2)] || null : null;
}

/**
 * Twelve months of a fixed lease against twelve months with us.
 *
 * The per-month arrays are the source of truth and the annual figures are their
 * sums, never a separately derived number. That is deliberate: a headline total
 * that does not equal the bars underneath it is the one error on this page that
 * would be worth lying about, so it is made structurally impossible instead.
 * ownerModel.test.js holds that line.
 *
 * @param {{psf:number, sqft:number}} state
 */
export function model(state = DEFAULT_STATE) {
  const market = state.psf * state.sqft;
  const floorMo = market * FLOORPCT, floorYear = floorMo * 12;
  const grossYear = market * UPLIFT * 12;
  const surplus = Math.max(0, grossYear - grossYear * OPEX - floorYear);
  const leaseM = [], shareM = [], ss = SEASON.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 12; i++) {
    /* the void is three quarters of a month, so the turnover month pays a quarter */
    let l = i === VOID_MONTH ? market * (1 - VOIDMO) : market;
    /* the agent's half month and the year's repairs come out of the first month */
    if (i === 0) l -= market * AGENTMO + market * 12 * REPAIRS;
    leaseM.push(Math.max(l, 0));
    shareM.push({ floor: floorMo, up: (surplus * SHARE) * (SEASON[i] / ss) });
  }

  const leaseTotal = leaseM.reduce((a, b) => a + b, 0);
  const ourTotal = shareM.reduce((a, s) => a + s.floor + s.up, 0);
  const upliftPct = Math.round((ourTotal / leaseTotal - 1) * 100);

  return { market, floorMo, floorYear, grossYear, surplus, leaseM, shareM, leaseTotal, ourTotal, upliftPct };
}
