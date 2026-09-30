/** Offline acceptance gate for a reviewed public-source pilot.
 * SOURCE_CONFIRMED means publication/association checked, never mailbox delivery
 * or consent to marketing. Input provenance still requires an actual source review.
 */
import { createHash } from 'node:crypto';

export const GENERIC_MAILBOXES = new Set(['info', 'office', 'skola', 'school', 'sekretariat', 'kancelar', 'podatelna']);
const NAME_NOISE = new Set(['google', 'classroom', 'microsoft', 'facebook', 'instagram', 'kontakt', 'kontakty', 'škola', 'school']);
const fold = s => s.normalize('NFKC').toLocaleLowerCase('cs-CZ').replace(/\s+/gu, ' ').trim();
const host = u => new URL(u).hostname.toLowerCase().replace(/^www\./u, '');
const plain = v => typeof v === 'string' && v.trim().length > 0;
const nameKey = o => `${fold(o.firstName)}|${fold(o.lastName)}`;
const mailboxKey = o => `${o.schoolKey}|${normalizePublishedEmail(o.email)}`;

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function publicHttpUrl(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password
      && u.hostname.includes('.') && !/^\[|^\d+(?:\.\d+){3}$|(^|\.)localhost$|\.(?:local|internal|test|invalid)$/iu.test(u.hostname);
  } catch { return false; }
}
export function normalizePublishedEmail(value) {
  if (typeof value !== 'string') return '';
  let result = value.trim().replace(/^mailto:/iu, '').split('?')[0];
  try { result = decodeURIComponent(result); } catch { return ''; }
  return result
    .replace(/\s*(?:\[at\]|\(at\)|\[zavináč\]|\(zavináč\)|\[zavinac\]|\(zavinac\))\s*/giu, '@')
    .replace(/\s*(?:\[dot\]|\(dot\)|\[tečka\]|\(tečka\)|\[tecka\]|\(tecka\))\s*/giu, '.')
    .replace(/\s*@\s*/gu, '@').toLowerCase();
}
export function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.')
    && !local.includes('..') && /^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+$/iu.test(local)
    && domain.length <= 253 && domain.split('.').length >= 2
    && domain.split('.').every(p => p.length >= 1 && p.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(p))
    && /^[a-z]{2,63}$/iu.test(domain.split('.').at(-1));
}
function nameIsPublished(observation) {
  const visible = fold(observation.publishedName ?? '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ');
  const tokens = `${observation.firstName} ${observation.lastName}`.split(/[\s’'\-]+/u).filter(Boolean).map(fold);
  const visibleTokens = new Set(visible.split(/\s+/u));
  return tokens.length >= 2 && tokens.every(token => visibleTokens.has(token));
}
export function validateObservation(observation, school, date) {
  const errors = [];
  if (!school) return ['UNKNOWN_SCHOOL'];
  if (!plain(school.name) || !plain(school.address) || !['ZŠ', 'SŠ', 'ZŠ+SŠ'].includes(school.type)) errors.push('INCOMPLETE_SCHOOL');
  if (school.scope !== 'Praha' || !/Praha|Prague/iu.test(school.address) || /Praha\s*[-–—]\s*(?:východ|západ)/iu.test(school.address)) errors.push('OUTSIDE_SCOPE');
  if (!publicHttpUrl(school.website) || !publicHttpUrl(school.addressSourceUrl)) errors.push('INVALID_SCHOOL_SOURCE');
  if (!publicHttpUrl(observation.sourceUrl)) errors.push('INVALID_CONTACT_SOURCE');
  else if (publicHttpUrl(school.website) && host(school.website) !== host(observation.sourceUrl)) errors.push('NON_OFFICIAL_CONTACT_SOURCE');
  if (!plain(observation.firstName) || !plain(observation.lastName)) errors.push('MISSING_NAME');
  else {
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s’'\-]*$/u.test(observation.firstName)
      || !/^[\p{L}\p{M}][\p{L}\p{M}\s’'\-]*$/u.test(observation.lastName)) errors.push('INVALID_NAME');
    if ([...fold(observation.firstName).split(' '), ...fold(observation.lastName).split(' ')].some(x => NAME_NOISE.has(x))) errors.push('NON_PERSON_NAME');
    if (!nameIsPublished(observation)) errors.push('NAME_NOT_IN_EVIDENCE');
  }
  const email = normalizePublishedEmail(observation.email);
  if (!validEmail(email)) errors.push('INVALID_EMAIL_SYNTAX');
  if (email !== normalizePublishedEmail(observation.publishedEmail)) errors.push('EMAIL_NOT_PUBLISHED');
  if (GENERIC_MAILBOXES.has(email.split('@')[0])) errors.push('GENERIC_MAILBOX');
  if ((observation.alternateEmails ?? []).some(e => normalizePublishedEmail(e) !== email)) errors.push('CONFLICTING_PUBLISHED_EMAILS');
  if (observation.reviewed !== true) errors.push('SOURCE_REVIEW_REQUIRED');
  if (observation.validUntil && (!validDate(observation.validUntil) || observation.validUntil < date)) errors.push('EXPIRED_ASSOCIATION');
  if (observation.validFrom && (!validDate(observation.validFrom) || observation.validFrom > date)) errors.push('FUTURE_ASSOCIATION');
  return [...new Set(errors)];
}

export function buildPilot(capture, previousLedger = { schemaVersion: 1, records: [] }) {
  if (capture?.schemaVersion !== 1 || !validDate(capture.collectionDate) || !Array.isArray(capture.schools)
    || !Array.isArray(capture.observations) || capture.collectionMethod !== 'ASSISTED_PUBLIC_WEB_REVIEW') throw new Error('Invalid capture schema/date/method.');
  if (previousLedger?.schemaVersion !== 1 || !Array.isArray(previousLedger.records)) throw new Error('Invalid previous ledger.');
  const schoolMap = new Map();
  for (const s of capture.schools) {
    if (!plain(s.key) || schoolMap.has(s.key)) throw new Error('Missing or duplicate school key.');
    schoolMap.set(s.key, s);
  }
  const history = new Map();
  for (const old of previousLedger.records) {
    if (!validDate(old.collectedAt) || !validDate(old.lastObservedAt) || old.lastObservedAt > capture.collectionDate) throw new Error('Invalid or newer previous ledger.');
    history.set(old.key, structuredClone(old));
  }
  const pending = [];
  const review = [...(capture.unresolved ?? [])].map(r => ({...r, reason: r.reason ?? 'REVIEW_REQUIRED', status: 'REVIEW_REQUIRED'}));
  for (const o of capture.observations) {
    const errors = validateObservation(o, schoolMap.get(o.schoolKey), capture.collectionDate);
    if (errors.length) review.push({...o, reason: errors.join('; '), status: 'REVIEW_REQUIRED'});
    else pending.push(o);
  }
  // Do not silently reuse a role mailbox for a different person, including across runs.
  const identities = new Map();
  for (const o of pending) {
    const key = mailboxKey(o);
    const set = identities.get(key) ?? new Set();
    set.add(nameKey(o));
    if (history.has(key)) set.add(history.get(key).personKey);
    identities.set(key, set);
  }
  const accepted = new Map();
  let duplicateObservations = 0;
  for (const o of pending) {
    const key = mailboxKey(o);
    const old = history.get(key);
    if (identities.get(key).size > 1) {
      review.push({...o, reason: 'SHARED_OR_REASSIGNED_MAILBOX', status: 'REVIEW_REQUIRED'});
      if (old) history.set(key, {...old, status: 'REVIEW_REQUIRED'});
      continue;
    }
    if (old?.suppressed === true) {
      review.push({...o, reason: 'SUPPRESSED_CONTACT', status: 'EXCLUDED'});
      continue;
    }
    const existing = accepted.get(key);
    if (existing) duplicateObservations++;
    const school = schoolMap.get(o.schoolKey);
    const sources = [...new Set([...(old?.sources ?? []), ...(existing?.sources ?? []), o.sourceUrl])].sort();
    const record = {
      key, schoolKey: o.schoolKey, personKey: nameKey(o), firstName: o.firstName.trim(), lastName: o.lastName.trim(),
      email: normalizePublishedEmail(o.email), schoolName: school.name, schoolAddress: school.address,
      schoolWebsite: school.website, schoolType: school.type, role: o.role ?? '', sources,
      addressSourceUrl: school.addressSourceUrl, collectedAt: old?.collectedAt ?? capture.collectionDate,
      lastObservedAt: capture.collectionDate, status: 'SOURCE_CONFIRMED', collectionMethod: capture.collectionMethod,
      deliveryVerified: false, marketingPermission: 'NOT_ASSESSED', suppressed: false,
    };
    accepted.set(key, record);
    history.set(key, record);
  }
  const contacts = [...accepted.values()].sort((a,b) => a.schoolName.localeCompare(b.schoolName, 'cs') || a.lastName.localeCompare(b.lastName, 'cs') || a.firstName.localeCompare(b.firstName, 'cs'));
  const schools = capture.schools.map(s => ({...s, confirmedContacts: contacts.filter(c => c.schoolKey === s.key).length}));
  const summary = {
    collectionDate: capture.collectionDate, collectionMethod: capture.collectionMethod,
    schoolsReviewed: schools.length, schoolsWithContacts: schools.filter(s => s.confirmedContacts > 0).length,
    confirmedContacts: contacts.length,
    schoolPersonPairs: new Set(contacts.map(c => `${c.schoolKey}|${c.personKey}`)).size,
    duplicateObservations, reviewItems: review.length,
    primarySchools: schools.filter(s => s.type === 'ZŠ').length,
    secondarySchools: schools.filter(s => s.type === 'SŠ').length,
    combinedSchools: schools.filter(s => s.type === 'ZŠ+SŠ').length,
    autonomousCrawlerRun: false, postgresIntegrationTested: false,
    deliveryVerified: false, marketingPermission: 'NOT_ASSESSED',
    captureSha256: createHash('sha256').update(JSON.stringify(capture)).digest('hex'),
  };
  return {summary, schools, contacts, review, ledger: {schemaVersion: 1, records: [...history.values()]}};
}
