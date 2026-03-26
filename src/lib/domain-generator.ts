const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const BASE = CHARS.length; // 36

export const DEFAULT_TLDS = ["com", "ai", "space"] as const;
export type TLD = (typeof DEFAULT_TLDS)[number];

export function getTotalDomains(
  tlds: readonly string[] = DEFAULT_TLDS,
  maxLength = 3,
): number {
  let count = 0;
  for (let len = 1; len <= maxLength; len++) {
    count += Math.pow(BASE, len);
  }
  return count * tlds.length;
}

/**
 * Maps a linear offset to a (name, tld) pair.
 *
 * Layout: for each name length 1..3, iterate all names, then for each name
 * iterate all TLDs. So offset 0 = "a.com", 1 = "a.ai", 2 = "a.space",
 * 3 = "b.com", etc.
 */
export function getDomainAtOffset(
  offset: number,
  tlds: readonly string[] = DEFAULT_TLDS,
  maxLength = 3,
): { name: string; tld: string; fullDomain: string } | null {
  const tldCount = tlds.length;
  let remaining = offset;

  for (let len = 1; len <= maxLength; len++) {
    const namesInGroup = Math.pow(BASE, len);
    const groupSize = namesInGroup * tldCount;

    if (remaining < groupSize) {
      const nameIndex = Math.floor(remaining / tldCount);
      const tldIndex = remaining % tldCount;
      const name = indexToName(nameIndex, len);
      const tld = tlds[tldIndex]!;
      return { name, tld, fullDomain: `${name}.${tld}` };
    }
    remaining -= groupSize;
  }

  return null;
}

/**
 * Gets a batch of domain names starting at `offset`.
 * Returns up to `batchSize` domains.
 */
export function getDomainBatch(
  offset: number,
  batchSize: number,
  tlds: readonly string[] = DEFAULT_TLDS,
  maxLength = 3,
): { name: string; tld: string; fullDomain: string }[] {
  const total = getTotalDomains(tlds, maxLength);
  const results: { name: string; tld: string; fullDomain: string }[] = [];

  for (let i = 0; i < batchSize && offset + i < total; i++) {
    const domain = getDomainAtOffset(offset + i, tlds, maxLength);
    if (domain) results.push(domain);
  }

  return results;
}

function indexToName(index: number, length: number): string {
  let result = "";
  let remaining = index;
  for (let i = 0; i < length; i++) {
    result = CHARS[remaining % BASE]! + result;
    remaining = Math.floor(remaining / BASE);
  }
  return result;
}
