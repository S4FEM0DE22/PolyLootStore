package com.polyloot.customer;

public class OAuthRequestTest {
    private static void reject(OAuthRequest pending, String link, long now) throws Exception {
        try { pending.accept(link, now); } catch (IllegalArgumentException error) { return; }
        throw new AssertionError("Untrusted callback accepted");
    }
    public static void main(String[] args) throws Exception {
        long now = 1000000;
        OAuthRequest pending = OAuthRequest.create(now);
        String code = "12345678-1234-1234-1234-123456789abc";
        String link = "com.polyloot.customer://oauth/callback?code=" + code + "&state=" + pending.state;
        if (!code.equals(pending.accept(link, now + 1000))) throw new AssertionError();
        if (!pending.challenge().matches("[A-Za-z0-9_-]{43}")) throw new AssertionError();
        OAuthRequest known = new OAuthRequest("a".repeat(43), "b".repeat(43), now);
        if (!"ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA".equals(known.challenge())) throw new AssertionError("Incorrect S256 challenge");
        reject(pending, link, now + OAuthRequest.MAX_AGE_MS);
        reject(pending, link, now - 1);
        reject(pending, link.replace("oauth/", "evil/"), now);
        reject(pending, link.replace("oauth/", "user@oauth/"), now);
        reject(pending, link.replace("/callback", "/callback/"), now);
        reject(pending, link.replace("com.polyloot.customer:", "https:"), now);
        reject(pending, link + "&state=" + pending.state, now);
        reject(pending, link + "&access_token=secret", now);
        reject(pending, link + "#fragment", now);
        reject(pending, link.replace(pending.state, "x".repeat(43)), now);
        reject(pending, link.replace(code, "bad"), now);
        System.out.println("Native PKCE: challenge, expiry, state and strict URI checks passed");
    }
}
