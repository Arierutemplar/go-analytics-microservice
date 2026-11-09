const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\/(?:3[0-2]|[12]?\d))?$/;

const IPV6 = /^[0-9a-fA-F:]+(?:\/(?:12[0-8]|1[01]\d|\d{1,2}))?$/;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function isIpOrCidr(value: string): boolean {
  if (IPV4.test(value)) return true;
  return value.includes(":") && IPV6.test(value);
}

export function parseAllowlist(raw: string): ParseResult<string[]> {
  const lines = raw
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length > 20) {
    return { ok: false, message: "Allow up to 20 IP addresses or CIDR ranges." };
  }
  for (const line of lines) {
    if (!isIpOrCidr(line)) {
      return { ok: false, message: `${line} is not an IPv4, IPv6, or CIDR range.` };
    }
  }
  return { ok: true, value: lines };
}

export function parsePositiveInt(raw: string, label: string, max: number): ParseResult<number> {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: `${label} must be a whole number.` };
  }
  const value = Number(trimmed);
  if (value < 1 || value > max) {
    return {
      ok: false,
      message: `${label} must be between 1 and ${max.toLocaleString("en-US")}.`,
    };
  }
  return { ok: true, value };
}

export function parseOptionalCap(raw: string): ParseResult<number | null> {
  if (raw.trim() === "") return { ok: true, value: null };
  return parsePositiveInt(raw, "Monthly token cap", 1_000_000_000);
}
