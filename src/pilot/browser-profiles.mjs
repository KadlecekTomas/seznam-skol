/** Execute only in a clean browser on an allowed public staff directory.
 * Raw names are preserved. This collector does not guess names or email addresses.
 * Run: node src/pilot/browser-profiles.mjs | agent-browser eval --stdin
 */
export async function collectPublicProfileCards(options = {}) {
  const maxCards = options.maxCards ?? 150;
  if (!Number.isInteger(maxCards) || maxCards < 1 || maxCards > 500) throw new Error('Invalid profile budget');
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalized = text => (text ?? '').replace(/\s+/g, ' ').trim();
  const visible = el => el.getClientRects().length > 0;
  const closeButton = () => Array.from(document.querySelectorAll('button')).find(b => visible(b) && normalized(b.textContent) === 'Zavřít');
  if (closeButton()) throw new Error('Close the existing dialog before starting capture.');
  const sourceUrl = location.href;
  const cards = Array.from(document.querySelectorAll('button')).filter(b => visible(b) && /zobrazit profil/i.test(b.textContent) && b.querySelector('h3,h4'));
  const discoveredNames = cards.map(b => normalized(b.querySelector('h3,h4').textContent));
  const observations = [];
  for (let index = 0; index < Math.min(cards.length, maxCards); index++) {
    if (location.href !== sourceUrl) throw new Error('Unexpected navigation; stopped capture.');
    const card = cards[index]; const cardName = discoveredNames[index];
    card.click(); let close = null;
    for (let attempt = 0; attempt < 50; attempt++) { await delay(30); close = closeButton(); if (close) break; }
    if (!close) { observations.push({ index, cardName, status: 'OPEN_FAILED', publishedEmails: [] }); break; }
    let panel = close.parentElement;
    for (let level = 0; level < 4 && panel && !panel.querySelector('h2'); level++) panel = panel.parentElement;
    const publishedName = normalized(panel?.querySelector('h2')?.textContent);
    const text = panel?.innerText ?? '';
    const publishedEmails = [...new Set(Array.from(panel?.querySelectorAll('span,a') ?? []).filter(visible).map(e => normalized(e.innerText)).filter(t => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)))];
    observations.push({ index, cardName, publishedName, publishedEmails, text, sourceUrl, observedAt: new Date().toISOString(), status: publishedName === cardName ? 'OPENED' : 'NAME_MISMATCH' });
    close.click();
    for (let attempt = 0; attempt < 50 && closeButton(); attempt++) await delay(30);
    if (closeButton()) break;
  }
  return { sourceUrl, expectedCards: cards.length, discoveredNames, observations, budgetExhausted: cards.length > maxCards };
}

export function profileCoverage(capture) {
  const { expectedCards, discoveredNames, observations } = capture;
  if (!Number.isInteger(expectedCards) || expectedCards < 0 || !Array.isArray(discoveredNames) || discoveredNames.length !== expectedCards || !Array.isArray(observations)) throw new Error('Invalid capture inventory');
  const successful = observations.filter(o => o.status === 'OPENED' && Number.isInteger(o.index) && o.index >= 0 && o.index < expectedCards && o.publishedName === discoveredNames[o.index] && o.cardName === discoveredNames[o.index]);
  const indexes = new Set(successful.map(o => o.index));
  const allPeople = new Set(discoveredNames);
  const peopleWithEmails = new Set(successful.filter(o => o.publishedEmails?.length > 0).map(o => o.publishedName));
  const checked = expectedCards > 0 && indexes.size === expectedCards && !capture.budgetExhausted;
  return { expectedCards, openedCards: indexes.size, expectedPeople: allPeople.size, peopleWithPublishedEmail: peopleWithEmails.size,
    peopleWithoutPublishedEmail: checked ? [...allPeople].filter(n => !peopleWithEmails.has(n)) : [],
    status: expectedCards === 0 ? 'NO_PROFILE_CONTROLS' : checked ? 'PROFILES_CHECKED' : 'PARTIAL',
    allEmployeesKnown: false, mailboxDeliveryVerified: false };
}

// Print a self-contained expression; does not start a browser or access the network.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/browser-profiles.mjs')) process.stdout.write('(' + collectPublicProfileCards.toString() + ')()\n');
