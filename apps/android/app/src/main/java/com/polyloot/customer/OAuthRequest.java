package com.polyloot.customer;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

// Android-independent policy, exercised by the JVM regression tests.
final class OAuthRequest {
    static final long MAX_AGE_MS = 5 * 60 * 1000;
    final String verifier;
    final String state;
    final long createdAt;
    OAuthRequest(String verifier, String state, long createdAt) {
        this.verifier = verifier; this.state = state; this.createdAt = createdAt;
    }
    static OAuthRequest create(long now) { return new OAuthRequest(random(), random(), now); }
    private static String random() {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    String challenge() throws Exception {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
    }
    String accept(String link, long now) throws Exception {
        if (now < createdAt || now - createdAt >= MAX_AGE_MS || !verifier.matches("[A-Za-z0-9_-]{43}") || !state.matches("[A-Za-z0-9_-]{43}")) throw new IllegalArgumentException();
        URI uri = new URI(link);
        if (!"com.polyloot.customer".equals(uri.getScheme()) || !"oauth".equals(uri.getHost()) || !"/callback".equals(uri.getRawPath()) || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getRawFragment() != null) throw new IllegalArgumentException();
        Map<String, String> params = new HashMap<>();
        if (uri.getRawQuery() == null) throw new IllegalArgumentException();
        for (String pair : uri.getRawQuery().split("&", -1)) {
            String[] parts = pair.split("=", -1);
            if (parts.length != 2 || params.put(parts[0], parts[1]) != null) throw new IllegalArgumentException();
        }
        String code = params.get("code"); String returnedState = params.get("state");
        if (params.size() != 2 || code == null || !code.matches("[A-Za-z0-9_-]{20,256}") || returnedState == null || !MessageDigest.isEqual(state.getBytes(StandardCharsets.US_ASCII), returnedState.getBytes(StandardCharsets.US_ASCII))) throw new IllegalArgumentException();
        return code;
    }
}
