package com.softwarefinance.cofrinho;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import java.lang.reflect.Field;

/**
 * The "mini screen" opened by the widgets: a translucent window over the home screen running the
 * same web app, started directly on /quick (src/ui/screens/QuickAddScreen.tsx). It writes to the
 * same local database as the main app and closes itself after saving.
 */
public class QuickAddActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(CofrinhoPlugin.class);
        config = startingAt(this, quickPath(getIntent()));
        super.onCreate(savedInstanceState);
        getWindow().setFormat(PixelFormat.TRANSLUCENT);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        if (bridge != null) bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);
    }

    /** BridgeActivity switches to the opaque app theme; the mini screen keeps its translucent one. */
    @Override
    public void setTheme(int resid) {
        super.setTheme(R.style.AppTheme_QuickAdd);
    }

    /** `cofrinho://quick?kind=expense&category=…` → `/quick?kind=expense&category=…`. */
    static String quickPath(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        String query = data != null ? data.getEncodedQuery() : null;
        return query != null ? "/quick?" + query : "/quick";
    }

    private static CapConfig startingAt(Context context, String path) {
        CapConfig config = CapConfig.loadDefault(context);
        try {
            // Capacitor reads the start path only from capacitor.config; this window needs its own.
            Field startPath = CapConfig.class.getDeclaredField("startPath");
            startPath.setAccessible(true);
            startPath.set(config, path);
        } catch (ReflectiveOperationException ignored) {
            // The web app still opens /quick from the cofrinho:// link in the intent.
        }
        return config;
    }
}
