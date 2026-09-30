import * as cheerio from 'cheerio';
/** Discover interactive profiles even if their emails are absent from static HTML. */
export function discoverProfileInventory(html: string): string[] {
  const $ = cheerio.load(html); const names = new Set<string>();
  $('button').each((_, el) => {
    if (!/zobrazit profil/iu.test($(el).text())) return;
    const name = $(el).find('h3,h4').first().text().replace(/\s+/gu, ' ').trim();
    if (name) names.add(name);
  });
  return [...names];
}
