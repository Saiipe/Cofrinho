package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App-specific native features used by the web layer (src/services/native.ts):
 * pinned home-screen shortcuts, home-screen widgets and the data the widgets show.
 */
@CapacitorPlugin(name = "Cofrinho")
public class CofrinhoPlugin extends Plugin {

    private static final String[] WIDGET_KEYS = {
        "month", "spentLabel", "spent", "incomeLabel", "income", "balanceLabel", "balance", "expenseButton", "incomeButton"
    };

    @PluginMethod
    public void capabilities(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("pinShortcuts", ShortcutManagerCompat.isRequestPinShortcutSupported(context));
        boolean widgets = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            widgets = AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported();
        }
        result.put("pinWidgets", widgets);
        call.resolve(result);
    }

    @PluginMethod
    public void pinShortcut(PluginCall call) {
        Context context = getContext();
        String id = call.getString("id", "shortcut");
        String label = call.getString("label", context.getString(R.string.app_name));
        String url = call.getString("url", "cofrinho://");
        if (!url.startsWith("cofrinho://")) {
            call.reject("Unsupported link");
            return;
        }
        JSObject result = new JSObject();
        if (!ShortcutManagerCompat.isRequestPinShortcutSupported(context)) {
            result.put("requested", false);
            call.resolve(result);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity.class);
        ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, "pinned-" + id)
            .setShortLabel(label)
            .setLongLabel(label)
            .setIcon(IconCompat.createWithResource(context, shortcutIcon(call.getString("icon", ""))))
            .setIntent(intent)
            .build();
        result.put("requested", ShortcutManagerCompat.requestPinShortcut(context, shortcut, null));
        call.resolve(result);
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        JSObject result = new JSObject();
        boolean requested = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Context context = getContext();
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            if (manager.isRequestPinAppWidgetSupported()) {
                Class<?> provider = "summary".equals(call.getString("kind")) ? SummaryWidget.class : QuickAddWidget.class;
                requested = manager.requestPinAppWidget(new ComponentName(context, provider), null, null);
            }
        }
        result.put("requested", requested);
        call.resolve(result);
    }

    @PluginMethod
    public void updateWidgets(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor editor = context.getSharedPreferences(WidgetRenderer.PREFS, Context.MODE_PRIVATE).edit();
        for (String key : WIDGET_KEYS) {
            String value = call.getString(key);
            if (value != null) editor.putString(key, value);
        }
        editor.apply();
        WidgetRenderer.refreshAll(context);
        call.resolve();
    }

    private static int shortcutIcon(String icon) {
        switch (icon) {
            case "expense":
                return R.drawable.ic_shortcut_expense;
            case "income":
                return R.drawable.ic_shortcut_income;
            case "search":
                return R.drawable.ic_shortcut_search;
            case "garden":
                return R.drawable.ic_shortcut_garden;
            case "goals":
                return R.drawable.ic_shortcut_goals;
            case "cards":
                return R.drawable.ic_shortcut_cards;
            default:
                return R.mipmap.ic_launcher;
        }
    }
}
