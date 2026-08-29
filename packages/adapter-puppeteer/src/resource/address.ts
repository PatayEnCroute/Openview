import { isIPv4, isIPv6 } from 'node:net';

/**
 * Address families a broker may connect to.
 *
 * Everything else -- loopback, link-local, private, carrier-grade, multicast, unspecified,
 * documentation, benchmarking, unique-local -- is refused, because a hostname that resolves there
 * reaches the machine or the network the renderer runs on rather than the public asset it names.
 */
export type AddressVerdict = 'public' | 'refused';

const octetsOf = (address: string): readonly number[] =>
  address.split('.').map((part) => Number.parseInt(part, 10));

/** Classifies an IPv4 literal against the ranges a document may never reach. */
export function classifyIpv4(address: string): AddressVerdict {
  const [a = 0, b = 0] = octetsOf(address);
  if (a === 0 || a === 10 || a === 127) {
    return 'refused';
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return 'refused';
  }
  if (a === 169 && b === 254) {
    return 'refused';
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return 'refused';
  }
  if (a === 192 && (b === 0 || b === 88 || b === 168)) {
    return 'refused';
  }
  if (a === 198 && (b === 18 || b === 19 || b === 51)) {
    return 'refused';
  }
  if (a === 203 && b === 0) {
    return 'refused';
  }
  if (a >= 224) {
    return 'refused';
  }
  return 'public';
}

/** Expands an IPv6 literal into its eight groups, or `undefined` when it is not one. */
function groupsOf(address: string): readonly number[] | undefined {
  const zone = address.indexOf('%');
  const bare = zone === -1 ? address : address.slice(0, zone);
  const halves = bare.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  /* A trailing dotted quad is the spelling `::ffff:127.0.0.1` uses, and reading it as one
     hexadecimal group would turn loopback into an address that looks routable. */
  const read = (part: string): readonly number[] | undefined => {
    if (part === '') {
      return [];
    }
    const groups: number[] = [];
    for (const [at, piece] of part.split(':').entries()) {
      if (piece.includes('.')) {
        if (at !== part.split(':').length - 1 || !isIPv4(piece)) {
          return undefined;
        }
        const [a = 0, b = 0, c = 0, d = 0] = piece.split('.').map((octet) => Number(octet));
        groups.push((a << 8) + b, (c << 8) + d);
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) {
        return undefined;
      }
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };
  const head = read(halves[0] ?? '');
  const tail = read(halves[1] ?? '');
  if (head === undefined || tail === undefined) {
    return undefined;
  }
  if (halves.length === 1) {
    return head.length === 8 ? head : undefined;
  }
  const filled = 8 - head.length - tail.length;
  if (filled < 0) {
    return undefined;
  }
  return [...head, ...Array.from({ length: filled }, () => 0), ...tail];
}

const quad = (high: number, low: number): string =>
  [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');

/**
 * The IPv4 address an IPv6 address really carries, when it carries one.
 *
 * Four families do: the mapped and compatible forms, the well-known NAT64 prefix and 6to4. All of
 * them reach an IPv4 destination, so all of them have to meet the IPv4 rules rather than pass as an
 * ordinary global address.
 */
function mappedIpv4(groups: readonly number[]): string | undefined {
  const [first = 0, second = 0, third = 0] = groups;
  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  /* 2002::/16 carries its address in the two groups right after the prefix. */
  if (first === 0x2002) {
    return quad(second, third);
  }
  /* 64:ff9b::/96, whose last two groups are the address. The local prefix `64:ff9b:1::/48` places
     it elsewhere and is not read here: it falls through to the allowlist, which refuses it. */
  if (first === 0x0064 && second === 0xff9b && third === 0) {
    return quad(high, low);
  }
  if (groups.slice(0, 5).some((group) => group !== 0)) {
    return undefined;
  }
  const marker = groups[5] ?? 0;
  if (marker !== 0xffff && marker !== 0) {
    return undefined;
  }
  if (marker === 0 && high === 0 && low <= 1) {
    /* `::` and `::1` are the unspecified and loopback addresses, not a mapping. */
    return '0.0.0.0';
  }
  return quad(high, low);
}

/**
 * Classifies an IPv6 literal, following an embedded IPv4 address into the IPv4 rules.
 *
 * Outside the embedded forms this is an allowlist, not a list of exclusions: only `2000::/3` is
 * globally routable unicast today, so every other prefix -- link-local, unique-local, site-local,
 * multicast, unspecified and everything unassigned -- is refused by not being named. Two blocks
 * inside `2000::/3` are named all the same, because neither reaches an ordinary host.
 */
export function classifyIpv6(address: string): AddressVerdict {
  const groups = groupsOf(address);
  if (groups === undefined) {
    return 'refused';
  }
  const embedded = mappedIpv4(groups);
  if (embedded !== undefined) {
    return classifyIpv4(embedded);
  }
  const first = groups[0] ?? 0;
  if ((first & 0xe000) !== 0x2000) {
    return 'refused';
  }
  const second = groups[1] ?? 0;
  /* 2001:db8::/32 documentation, and 2001:0::/32 teredo, which tunnels to an IPv4 server. */
  if (first === 0x2001 && (second === 0x0db8 || second === 0x0000)) {
    return 'refused';
  }
  return 'public';
}

/** Classifies any literal address, refusing anything that is not one. */
export function classifyAddress(address: string): AddressVerdict {
  if (isIPv4(address)) {
    return classifyIpv4(address);
  }
  if (isIPv6(address)) {
    return classifyIpv6(address);
  }
  return 'refused';
}

/**
 * The canonical spelling of an https url a manifest may authorise.
 *
 * Returns `undefined` for anything a document must never make the renderer open: another scheme,
 * embedded credentials, or a url whose canonical form differs from the authorised text -- the
 * comparison must be on one spelling, or two strings would name the same target.
 */
export function normalizeHttpsUrl(source: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }
  if (url.username !== '' || url.password !== '') {
    return undefined;
  }
  if (url.port !== '') {
    /* A url that still carries a port carries one other than 443, since `URL` drops the default:
       a document able to name any port turns an authorised host into a port scanner. */
    return undefined;
  }
  if (url.href !== source) {
    return undefined;
  }
  return url;
}
