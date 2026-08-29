import { describe, expect, it } from 'vitest';
import { classifyAddress, classifyIpv4, classifyIpv6, normalizeHttpsUrl } from '../address.js';

describe('the addresses a rendered document may reach', () => {
  it('accepts an ordinary public IPv4 address', () => {
    for (const address of ['93.184.216.34', '1.1.1.1', '8.8.8.8', '172.32.0.1', '192.169.0.1']) {
      expect(classifyIpv4(address)).toBe('public');
    }
  });

  it('refuses loopback, the unspecified range and every private block', () => {
    for (const address of [
      '127.0.0.1',
      '127.1.2.3',
      '0.0.0.0',
      '10.0.0.7',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '100.64.0.1',
    ]) {
      expect(classifyIpv4(address)).toBe('refused');
    }
  });

  it('refuses the link-local block cloud metadata lives in', () => {
    /* The single most valuable target a document could name: the instance credentials endpoint. */
    expect(classifyIpv4('169.254.169.254')).toBe('refused');
  });

  it('refuses the documentation, benchmark, anycast and multicast blocks', () => {
    for (const address of [
      '192.0.2.1',
      '198.51.100.4',
      '203.0.113.9',
      '198.18.0.1',
      '192.88.99.1',
      '224.0.0.1',
      '239.1.1.1',
      '255.255.255.255',
    ]) {
      expect(classifyIpv4(address)).toBe('refused');
    }
  });

  it('accepts a public IPv6 address', () => {
    expect(classifyIpv6('2606:4700:4700::1111')).toBe('public');
    expect(classifyIpv6('2a00:1450:4007:80f::200e')).toBe('public');
  });

  it('refuses IPv6 loopback, link-local, unique-local, multicast and documentation', () => {
    for (const address of [
      '::1',
      '::',
      'fe80::1',
      'fe80::1%eth0',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      '2001:db8::1',
    ]) {
      expect(classifyIpv6(address)).toBe('refused');
    }
  });

  it('follows an IPv4-mapped address into the IPv4 rules rather than reading it as public', () => {
    /* `::ffff:127.0.0.1` is loopback written in six colons, and a text comparison would miss it. */
    expect(classifyIpv6('::ffff:127.0.0.1')).toBe('refused');
    expect(classifyIpv6('::ffff:169.254.169.254')).toBe('refused');
    expect(classifyIpv6('::ffff:93.184.216.34')).toBe('public');
  });

  it('refuses an address that is not one at all', () => {
    for (const address of ['', 'localhost', 'not-an-address', '999.1.1.1', '2001:db8::x']) {
      expect(classifyAddress(address)).toBe('refused');
    }
  });

  it('reads a literal of either family through the one entry point', () => {
    expect(classifyAddress('93.184.216.34')).toBe('public');
    expect(classifyAddress('::1')).toBe('refused');
  });
});

describe('the urls a manifest may authorise', () => {
  it('accepts a canonical https url', () => {
    expect(normalizeHttpsUrl('https://assets.example.com/logo.png')?.hostname).toBe(
      'assets.example.com',
    );
  });

  it('refuses every scheme but https', () => {
    for (const url of [
      'http://assets.example.com/logo.png',
      'file:///etc/passwd',
      'ftp://assets.example.com/logo.png',
      'data:image/png;base64,AAAA',
      'not a url',
    ]) {
      expect(normalizeHttpsUrl(url)).toBeUndefined();
    }
  });

  it('refuses embedded credentials', () => {
    expect(normalizeHttpsUrl('https://user:secret@assets.example.com/logo.png')).toBeUndefined();
    expect(normalizeHttpsUrl('https://user@assets.example.com/logo.png')).toBeUndefined();
  });

  it('refuses a port this policy cannot state', () => {
    expect(normalizeHttpsUrl('https://assets.example.com:8443/logo.png')).toBeUndefined();
  });

  it('refuses a spelling that is not already canonical', () => {
    /* Two strings naming one target would let a manifest authorise one and a broker open the
       other. */
    expect(normalizeHttpsUrl('https://assets.example.com/a/../logo.png')).toBeUndefined();
    expect(normalizeHttpsUrl('https://assets.example.com')).toBeUndefined();
  });
});

describe('the spellings an IPv6 literal can take', () => {
  it('reads a fully written address, group by group', () => {
    expect(classifyIpv6('2606:4700:4700:0000:0000:0000:0000:1111')).toBe('public');
    expect(classifyIpv6('fe80:0000:0000:0000:0000:0000:0000:0001')).toBe('refused');
  });

  it('refuses a literal with two elisions, or with too many groups', () => {
    expect(classifyIpv6('2606::4700::1111')).toBe('refused');
    expect(classifyIpv6('1:2:3:4:5:6:7:8:9')).toBe('refused');
    expect(classifyIpv6('1:2:3:4:5:6:7')).toBe('refused');
  });

  it('refuses a group that is not hexadecimal, or a quad that is not last', () => {
    expect(classifyIpv6('2606:4700:zzzz::1')).toBe('refused');
    expect(classifyIpv6('::1.2.3.4:5')).toBe('refused');
    expect(classifyIpv6('::1.2.3')).toBe('refused');
  });

  it('reads the IPv4-compatible spelling as the IPv4 address it names', () => {
    expect(classifyIpv6('::93.184.216.34')).toBe('public');
    expect(classifyIpv6('::10.0.0.1')).toBe('refused');
  });
});

describe('the IPv6 prefixes that carry an IPv4 destination', () => {
  it('follows the well-known NAT64 prefix into the IPv4 rules', () => {
    /* `64:ff9b::/96` reaches an IPv4 host through a translator, so it meets the IPv4 rules rather
       than passing as an ordinary global address. */
    expect(classifyIpv6('64:ff9b::127.0.0.1')).toBe('refused');
    expect(classifyIpv6('64:ff9b::a9fe:a9fe')).toBe('refused');
    expect(classifyIpv6('64:ff9b::0a00:0001')).toBe('refused');
    expect(classifyIpv6('64:ff9b::5db8:d822')).toBe('public');
  });

  it('follows 6to4 into the IPv4 rules', () => {
    expect(classifyIpv6('2002:7f00:0001::1')).toBe('refused');
    expect(classifyIpv6('2002:c0a8:0001::1')).toBe('refused');
    expect(classifyIpv6('2002:5db8:d822::1')).toBe('public');
  });

  it('reads the neighbours of those prefixes as what they really are', () => {
    /* One digit away from the prefix, so no longer NAT64; and outside global unicast, so refused
       by the allowlist rather than accidentally accepted. */
    expect(classifyIpv6('64:ff9c::7f00:1')).toBe('refused');
    expect(classifyIpv6('65:ff9b::7f00:1')).toBe('refused');
    expect(classifyIpv6('2003:7f00:1::1')).toBe('public');
  });

  it('accepts only the range that is globally routable today', () => {
    /* An allowlist rather than a list of exclusions: `2000::/3` is the whole of global unicast, and
       a prefix nobody has assigned yet is refused by not being named. */
    expect(classifyIpv6('2000::1')).toBe('public');
    expect(classifyIpv6('3fff:ffff::1')).toBe('public');
    expect(classifyIpv6('1fff::1')).toBe('refused');
    expect(classifyIpv6('4000::1')).toBe('refused');
    expect(classifyIpv6('fe80::1')).toBe('refused');
    expect(classifyIpv6('fec0::1')).toBe('refused');
    expect(classifyIpv6('fc00::1')).toBe('refused');
    expect(classifyIpv6('feff::1')).toBe('refused');
  });

  it('refuses the two blocks inside global unicast that reach no ordinary host', () => {
    expect(classifyIpv6('2001:db8::1')).toBe('refused');
    /* Teredo tunnels to an IPv4 server whose address it carries. */
    expect(classifyIpv6('2001::1')).toBe('refused');
    expect(classifyIpv6('2001:df0::1')).toBe('public');
  });
});
