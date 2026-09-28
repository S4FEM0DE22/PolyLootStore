// Every refresh reads the HttpOnly-cookie session from the server. Lifecycle
// events carry no account/token data and cannot authenticate a guest.
export function createSessionSync(fetchSession, applySession) {
  let revision = 0;
  return {
    invalidate() { revision++; },
    async refresh(reason = 'resume') {
      const ticket = ++revision;
      const result = await fetchSession();
      if (ticket !== revision) return false;
      applySession(result.user || null, reason);
      return true;
    }
  };
}
