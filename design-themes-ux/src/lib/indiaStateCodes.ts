/**
 * indiaStateCodes.ts — normalizes a state name/code into the 2-letter code
 * the backend's checkout address validator requires (see
 * backend/src/modules/checkout/engines/address/address-validator.default.ts,
 * INDIA_STATES). The Address Book's State field is free text, so a saved
 * address someone typed as "Maharashtra" would otherwise fail checkout's
 * validation with a cryptic "Invalid Indian state code" error — this
 * normalizes on the way into the checkout API, without touching the backend
 * or the Address Book's own storage format.
 */

const STATE_NAME_TO_CODE: Record<string, string> = {
  'ANDAMAN AND NICOBAR ISLANDS': 'AN',
  'ANDHRA PRADESH': 'AP',
  'ARUNACHAL PRADESH': 'AR',
  ASSAM: 'AS',
  BIHAR: 'BR',
  CHANDIGARH: 'CH',
  CHHATTISGARH: 'CG',
  'DAMAN AND DIU': 'DD',
  'DADRA AND NAGAR HAVELI': 'DH',
  DELHI: 'DL',
  GOA: 'GA',
  GUJARAT: 'GJ',
  HARYANA: 'HR',
  'HIMACHAL PRADESH': 'HP',
  'JAMMU AND KASHMIR': 'JK',
  JHARKHAND: 'JH',
  KARNATAKA: 'KA',
  KERALA: 'KL',
  LADAKH: 'LD',
  'MADHYA PRADESH': 'MP',
  MAHARASHTRA: 'MH',
  MANIPUR: 'MN',
  MEGHALAYA: 'ML',
  MIZORAM: 'MZ',
  NAGALAND: 'NL',
  ODISHA: 'OD',
  PUDUCHERRY: 'PY',
  PUNJAB: 'PB',
  RAJASTHAN: 'RJ',
  SIKKIM: 'SK',
  'TAMIL NADU': 'TN',
  TELANGANA: 'TS',
  TRIPURA: 'TR',
  'UTTAR PRADESH': 'UP',
  UTTARAKHAND: 'UK',
  'WEST BENGAL': 'WB',
};

const VALID_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

/** Returns a valid 2-letter Indian state code when it can confidently resolve one, else the trimmed input unchanged. */
export function normalizeIndiaStateCode(state: string): string {
  const trimmed = state.trim();
  const upper = trimmed.toUpperCase();
  if (VALID_CODES.has(upper)) return upper;
  return STATE_NAME_TO_CODE[upper] ?? trimmed;
}
