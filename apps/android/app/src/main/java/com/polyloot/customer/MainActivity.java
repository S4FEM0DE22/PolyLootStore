package com.polyloot.customer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private final Uri origin = Uri.parse(BuildConfig.SITE_URL);
    private boolean showingError;
    private boolean oauthBusy;
    private SharedPreferences oauthPreferences;
    private ValueCallback<Uri[]> fileCallback;
    private static final int PICK_FILE = 1001;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        oauthPreferences = getSharedPreferences("pending-google-oauth", MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " PolyLootCustomerAndroid/" + BuildConfig.VERSION_NAME);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return request.isForMainFrame() && route(request.getUrl(), false);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                // User-selected images only; no camera/storage permission or arbitrary native access.
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                try { startActivityForResult(pick, PICK_FILE); }
                catch (ActivityNotFoundException error) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message result) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        route(request.getUrl(), true);
                        view.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(popup);
                result.sendToTarget();
                return true;
            }
        });
        // Delivery URLs are signed tokens; no app cookies are passed to other sites.
        web.setDownloadListener((url, agent, disposition, mime, size) -> openBrowser(Uri.parse(url)));
        if (state == null || web.restoreState(state) == null) web.loadUrl(BuildConfig.SITE_URL + "/");
        receiveOAuth(getIntent());
    }
    private boolean sameOrigin(Uri uri) {
        return "https".equals(uri.getScheme()) && origin.getHost().equals(uri.getHost()) && origin.getPort() == uri.getPort() && uri.getUserInfo() == null;
    }
    private boolean route(Uri uri, boolean popup) {
        String path = uri.getPath() == null ? "/" : uri.getPath();
        if (sameOrigin(uri)) {
            if (path.equals("/auth/android/start")) { beginOAuth(); return true; }
            if (path.equals("/admin") || path.startsWith("/admin/") || path.equals("/api/admin") || path.startsWith("/api/admin/")) {
                Toast.makeText(this, "แอปนี้สำหรับลูกค้าเท่านั้น", Toast.LENGTH_SHORT).show(); return true;
            }
            if (path.equals("/api/download") || path.startsWith("/assets/samples/")) { openBrowser(uri); return true; }
            if (popup) { web.loadUrl(uri.toString()); return true; }
            return false;
        }
        openBrowser(uri); return true;
    }
    private void beginOAuth() {
        if (oauthBusy) return;
        try {
            OAuthRequest pending = OAuthRequest.create(System.currentTimeMillis());
            // App-private, excluded from backup. The verifier never enters a URL.
            if (!oauthPreferences.edit().putString("verifier", pending.verifier).putString("state", pending.state).putLong("createdAt", pending.createdAt).commit()) throw new IllegalStateException();
            Uri start = origin.buildUpon().path("/auth/android/start").appendQueryParameter("challenge", pending.challenge()).appendQueryParameter("state", pending.state).build();
            startActivity(new Intent(Intent.ACTION_VIEW, start));
        } catch (Exception error) {
            oauthPreferences.edit().clear().apply();
            Toast.makeText(this, "เริ่มเข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่", Toast.LENGTH_LONG).show();
        }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); receiveOAuth(intent);
    }
    private void receiveOAuth(Intent intent) {
        Uri link = intent == null ? null : intent.getData();
        if (link == null) return;
        intent.setData(null); // Do not replay an auth code after activity recreation.
        if (oauthBusy) return;
        try {
            OAuthRequest pending = new OAuthRequest(oauthPreferences.getString("verifier", ""), oauthPreferences.getString("state", ""), oauthPreferences.getLong("createdAt", 0));
            String code = pending.accept(link.toString(), System.currentTimeMillis());
            oauthBusy = true;
            // Consume before network exchange, rejecting duplicate callbacks.
            if (!oauthPreferences.edit().clear().commit()) throw new IllegalStateException();
            new Thread(() -> exchangeOAuth(code, pending.verifier), "polyloot-oauth").start();
        } catch (Exception error) {
            oauthBusy = false;
            Toast.makeText(this, "ลิงก์เข้าสู่ระบบไม่ตรงกับคำขอหรือหมดอายุ กรุณาเริ่มใหม่", Toast.LENGTH_LONG).show();
        }
    }
    private void exchangeOAuth(String code, String verifier) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(BuildConfig.SITE_URL + "/api/customer").openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Origin", BuildConfig.SITE_URL);
            byte[] body = new JSONObject().put("action", "android-google-session").put("code", code).put("verifier", verifier).toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
            if (connection.getResponseCode() != 200) throw new IllegalStateException();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] block = new byte[4096]; int count;
                while ((count = input.read(block)) != -1) {
                    if (buffer.size() + count > 65536) throw new IllegalStateException();
                    buffer.write(block, 0, count);
                }
            }
            if (new JSONObject(buffer.toString("UTF-8")).optJSONObject("user") == null) throw new IllegalStateException();
            String sessionCookie = null;
            for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                if ("set-cookie".equalsIgnoreCase(header.getKey())) {
                    for (String value : header.getValue()) {
                        if (value.startsWith("polyloot_customer=") && value.contains("HttpOnly") && value.contains("Secure")) sessionCookie = value;
                    }
                }
            }
            if (sessionCookie == null) throw new IllegalStateException();
            final String cookie = sessionCookie;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                CookieManager.getInstance().setCookie(BuildConfig.SITE_URL + "/api/", cookie, accepted -> {
                    oauthBusy = false;
                    if (!accepted) { oauthFailed(); return; }
                    CookieManager.getInstance().flush();
                    refreshAuthenticatedPage();
                });
            });
        } catch (Exception error) {
            runOnUiThread(() -> { oauthBusy = false; if (!isFinishing() && !isDestroyed()) oauthFailed(); });
        } finally { if (connection != null) connection.disconnect(); }
    }
    private void oauthFailed() {
        Toast.makeText(this, "เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาเปิดหน้าเข้าสู่ระบบแล้วลองใหม่", Toast.LENGTH_LONG).show();
        web.loadUrl(BuildConfig.SITE_URL + "/#login");
    }
    private void refreshAuthenticatedPage() {
        if (isFinishing() || isDestroyed()) return;
        if (web.getUrl() == null || !sameOrigin(Uri.parse(web.getUrl()))) { reloadAuthenticatedPage(); return; }
        // No identity/token injection: the page must re-read the verified
        // HttpOnly cookie from /api/customer before rendering the account.
        web.evaluateJavascript("(() => { window.__polylootAuthReturnPending = true; if (typeof window.polylootAuthReturn === 'function') { window.polylootAuthReturn(); return true; } return false; })()", handled -> {
            if (!isFinishing() && !isDestroyed() && !"true".equals(handled)) reloadAuthenticatedPage();
        });
    }
    private void reloadAuthenticatedPage() {
        // A fragment-only loadUrl is same-document navigation and retains the
        // old guest JS state. A distinct query forces a real load for old pages.
        web.loadUrl(BuildConfig.SITE_URL + "/?auth_return=" + System.currentTimeMillis() + "#profile");
    }
    private void openBrowser(Uri uri) {
        if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, "ไม่พบเบราว์เซอร์", Toast.LENGTH_SHORT).show(); }
    }
    private void showConnectionError() {
        if (showingError || isFinishing()) return;
        showingError = true;
        new AlertDialog.Builder(this).setTitle("เชื่อมต่อร้านไม่ได้")
            .setMessage("กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง")
            .setPositiveButton("ลองใหม่", (dialog, which) -> web.reload())
            .setNegativeButton("ปิด", null)
            .setOnDismissListener(dialog -> showingError = false).show();
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            Uri selected = result == RESULT_OK && data != null ? data.getData() : null;
            fileCallback.onReceiveValue(selected != null && "content".equals(selected.getScheme()) ? new Uri[]{selected} : null);
            fileCallback = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            if (!oauthBusy && web.getUrl() != null && sameOrigin(Uri.parse(web.getUrl()))) {
                web.evaluateJavascript("window.dispatchEvent(new Event('polyloot:resume'))", null);
            }
        }
    }
    @Override protected void onDestroy() { if (fileCallback != null) fileCallback.onReceiveValue(null); web.destroy(); super.onDestroy(); }
}
