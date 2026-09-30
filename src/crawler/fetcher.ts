export interface FetchedTextResource {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
}

export interface FetchTextOptions {
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string;
}

const DEFAULT_MAX_BYTES = 2_000_000;

export const fetchTextResource = async (
  url: string,
  options: FetchTextOptions = {},
): Promise<FetchedTextResource> => {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      accept:
        options.accept ??
        "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,text/plain;q=0.5",
      "user-agent":
        "seznam-skol/0.1 (+https://github.com/KadlecekTomas/seznam-skol)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = Number(
    response.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maxBytes
  ) {
    throw new Error(
      "Resource exceeds crawl size limit: " +
        declaredLength +
        " > " +
        maxBytes,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > maxBytes) {
    throw new Error(
      "Resource exceeds crawl size limit after download: " +
        bytes.byteLength +
        " > " +
        maxBytes,
    );
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  return {
    requestedUrl: url,
    finalUrl: response.url || url,
    status: response.status,
    contentType,
    text,
  };
};

export const isHtmlContentType = (contentType: string): boolean =>
  /(?:text\/html|application\/xhtml\+xml)/iu.test(contentType);

export const isXmlContentType = (contentType: string): boolean =>
  /(?:application|text)\/xml|\+xml/iu.test(contentType);
