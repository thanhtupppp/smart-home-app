describe('Firebase RTDB Security Rules Specification Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rulesJson = require('../../../database.rules.json');

  it('should exist and parse valid JSON rules', () => {
    expect(rulesJson).toBeDefined();
    expect(rulesJson.rules).toBeDefined();
  });

  describe('User Discovery & Profile Scope (/users/$uid)', () => {
    it('should restrict user root read/write to authenticated user only', () => {
      const userRule = rulesJson.rules.users['$uid'];
      expect(userRule['.read']).toContain('auth.uid === $uid');
      expect(userRule['.write']).toContain('auth.uid === $uid');
    });

    it('should enforce user homes discovery index protection (/users/$uid/homes)', () => {
      const userHomesRule = rulesJson.rules.users['$uid'].homes;
      expect(userHomesRule['.read']).toContain('auth.uid === $uid');
      expect(userHomesRule['$homeId']['.write']).toBeDefined();
    });
  });

  describe('Home Metadata & RBAC (/homes/$homeId)', () => {
    it('should restrict reported device writes from client (reported node write is false)', () => {
      const reportedRule = rulesJson.rules.homes['$homeId'].devices['$deviceId'].reported;
      expect(reportedRule['.write']).toBe(false);
      expect(reportedRule['.read']).toContain('members');
    });

    it('should require member existence to read devices, scenes, and commands', () => {
      const homeRule = rulesJson.rules.homes['$homeId'];
      expect(homeRule.devices['.read']).toContain('members');
      expect(homeRule.commands['.read']).toContain('members');
      expect(homeRule.scenes['.read']).toContain('members');
      expect(homeRule.rooms['.read']).toContain('members');
    });

    it('should protect members role modification from unauthorized clients', () => {
      const memberUidRule = rulesJson.rules.homes['$homeId'].members['$uid'];
      expect(memberUidRule['.write']).toContain("role').val() === 'owner'");
    });

    it('should deny catch-all other paths from public read/write', () => {
      const catchAllRule = rulesJson.rules['$other'];
      expect(catchAllRule['.read']).toBe(false);
      expect(catchAllRule['.write']).toBe(false);
    });
  });
});
