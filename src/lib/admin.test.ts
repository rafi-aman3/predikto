import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAdminEmails, isAdminEmail } from './admin';

afterEach(() => vi.unstubAllEnvs());

describe('getAdminEmails', () => {
  it('returns [] when unset', () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(getAdminEmails()).toEqual([]);
  });
  it('parses, trims, lowercases, and drops empties', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Rafi@SDS.com , ,owner@x.io ');
    expect(getAdminEmails()).toEqual(['rafi@sds.com', 'owner@x.io']);
  });
});

describe('isAdminEmail', () => {
  it('matches case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', 'rafi@sds.com');
    expect(isAdminEmail('RAFI@sds.com')).toBe(true);
  });
  it('is false for non-listed or missing emails', () => {
    vi.stubEnv('ADMIN_EMAILS', 'rafi@sds.com');
    expect(isAdminEmail('other@x.io')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
