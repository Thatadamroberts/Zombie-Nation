package com.zombienation.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Hosts the game (HTML5 canvas, bundled in assets/) in a full-screen WebView.
 * Save data is kept in SharedPreferences through a small JavaScript bridge.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "zombie_nation";
    private static final String SAVE_KEY = "save";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(18, 20, 23));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new SaveBridge(getSharedPreferences(PREFS, Context.MODE_PRIVATE), (Vibrator) getSystemService(Context.VIBRATOR_SERVICE)), "AndroidBridge");

        setContentView(webView);
        goImmersive();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    @SuppressWarnings("deprecation")
    private void goImmersive() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Let the game decide: it closes menus / pauses, and returns false on the title screen.
        webView.evaluateJavascript("(window.ZN && ZN.onBack) ? ZN.onBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onPause() {
        webView.evaluateJavascript("window.ZN && ZN.onPause && ZN.onPause()", null);
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        goImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** Exposed to JavaScript as window.AndroidBridge. */
    static class SaveBridge {
        private final SharedPreferences prefs;
        private final Vibrator vibrator;

        SaveBridge(SharedPreferences prefs, Vibrator vibrator) {
            this.prefs = prefs;
            this.vibrator = vibrator;
        }

        /** pattern: "30" for a single buzz, or "60,40,120" for buzz/pause/buzz in milliseconds. */
        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(String pattern) {
            if (vibrator == null || !vibrator.hasVibrator() || pattern == null) return;
            try {
                String[] parts = pattern.split(",");
                if (parts.length == 1) {
                    long ms = Math.min(500, Long.parseLong(parts[0].trim()));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vibrator.vibrate(ms);
                    }
                } else {
                    long[] timings = new long[parts.length + 1];
                    for (int i = 0; i < parts.length; i++) timings[i + 1] = Math.min(500, Long.parseLong(parts[i].trim()));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
                    } else {
                        vibrator.vibrate(timings, -1);
                    }
                }
            } catch (RuntimeException ignored) {
                // Bad pattern or vibrator unavailable: skip the buzz.
            }
        }

        @JavascriptInterface
        public String load() {
            return prefs.getString(SAVE_KEY, null);
        }

        @JavascriptInterface
        public void save(String json) {
            prefs.edit().putString(SAVE_KEY, json).apply();
        }
    }
}
