const PUBLIC_EMAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "seznam.cz",
  "email.cz",
  "post.cz",
  "centrum.cz",
  "atlas.cz",
  "volny.cz",
]);

const normalizeHost = (value: string): string =>
  value.trim().toLocaleLowerCase("en-US").replace(/^www\./u, "");

export const getEmailDomain = (email: string): string | null => {
  const normalized = email.trim().toLocaleLowerCase("en-US");
  const at = normalized.lastIndexOf("@");

  if (at <= 0 || at === normalized.length - 1) {
    return null;
  }

  const host = normalizeHost(normalized.slice(at + 1));

  if (!host.includes(".") || /\s/u.test(host)) {
    return null;
  }

  return host;
};

export const isPublicEmailHost = (host: string): boolean =>
  PUBLIC_EMAIL_HOSTS.has(normalizeHost(host));

export const normalizeWebsiteUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//iu.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    url.search = "";

    const host = normalizeHost(url.hostname);

    if (!host.includes(".")) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = host;
    url.pathname = url.pathname.replace(/\/+$/u, "") || "/";

    return url.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
};

export const deriveWebsiteCandidatesFromEmails = (
  emails: string[],
): string[] => {
  const candidates = new Set<string>();

  for (const email of emails) {
    const host = getEmailDomain(email);

    if (!host || isPublicEmailHost(host)) {
      continue;
    }

    const candidate = normalizeWebsiteUrl(host);

    if (candidate) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
};
