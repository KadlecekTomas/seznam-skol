interface RobotsRule {
  allow: boolean;
  pattern: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

const stripComment = (line: string): string =>
  line.replace(/\s*#.*$/u, "").trim();

const parseRobots = (text: string): RobotsGroup[] => {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let hasRules = false;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = stripComment(rawLine);
    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim().toLocaleLowerCase("en-US");
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!current || hasRules) {
        current = { agents: [], rules: [] };
        groups.push(current);
        hasRules = false;
      }

      current.agents.push(value.toLocaleLowerCase("en-US"));
      continue;
    }

    if (!current || (key !== "allow" && key !== "disallow")) {
      continue;
    }

    hasRules = true;

    if (key === "disallow" && value === "") {
      continue;
    }

    current.rules.push({
      allow: key === "allow",
      pattern: value,
    });
  }

  return groups;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[|\\{}()[\]^$+*?.]/gu, "\\$&");

const patternMatches = (pattern: string, path: string): boolean => {
  if (!pattern) {
    return false;
  }

  const endAnchored = pattern.endsWith("$");
  const source = (endAnchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map(escapeRegExp)
    .join(".*");

  const regex = new RegExp(
    "^" + source + (endAnchored ? "$" : ""),
    "u",
  );

  return regex.test(path);
};

export const isAllowedByRobots = (
  robotsText: string,
  url: string,
  userAgent = "seznam-skol",
): boolean => {
  const groups = parseRobots(robotsText);
  const normalizedAgent = userAgent.toLocaleLowerCase("en-US");
  const exactGroups = groups.filter((group) =>
    group.agents.some(
      (agent) => agent !== "*" && normalizedAgent.includes(agent),
    ),
  );
  const selected =
    exactGroups.length > 0
      ? exactGroups
      : groups.filter((group) => group.agents.includes("*"));

  if (selected.length === 0) {
    return true;
  }

  const parsed = new URL(url);
  const path = parsed.pathname + parsed.search;
  const matchingRules = selected
    .flatMap((group) => group.rules)
    .filter((rule) => patternMatches(rule.pattern, path))
    .sort((left, right) => {
      const lengthDifference =
        right.pattern.replace(/\*|\$/gu, "").length -
        left.pattern.replace(/\*|\$/gu, "").length;

      if (lengthDifference !== 0) {
        return lengthDifference;
      }

      return Number(right.allow) - Number(left.allow);
    });

  return matchingRules[0]?.allow ?? true;
};

export const fetchRobotsTxt = async (
  websiteUrl: string,
): Promise<string | null> => {
  try {
    const url = new URL("/robots.txt", websiteUrl);
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "seznam-skol/0.1 (+https://github.com/KadlecekTomas/seznam-skol)",
        accept: "text/plain,*/*;q=0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
};
