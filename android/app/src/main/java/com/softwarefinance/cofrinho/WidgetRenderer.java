package com.softwarefinance.cofrinho;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Builds the home-screen widgets from the values last pushed by the app (see CofrinhoPlugin.updateWidgets). */
final class WidgetRenderer {

    static final String PREFS = "cofrinho_widgets";

    private static final String HOME = "cofrinho://";
    private static final int[] CATEGORY_SLOTS = { R.id.widget_cat_1, R.id.widget_cat_2, R.id.widget_cat_3 };

    private WidgetRenderer() {}

    private static PendingIntent link(Context context, String url, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Opens the mini screen over the home screen (QuickAddActivity) instead of the whole app. */
    private static PendingIntent quickAdd(Context context, String query, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("cofrinho://quick?" + query), context, QuickAddActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void bindButtons(Context context, RemoteViews views, SharedPreferences prefs) {
        views.setTextViewText(R.id.widget_expense_label, prefs.getString("expenseButton", context.getString(R.string.widget_expense)));
        views.setTextViewText(R.id.widget_income_label, prefs.getString("incomeButton", context.getString(R.string.widget_income)));
        views.setOnClickPendingIntent(R.id.widget_expense, quickAdd(context, "kind=expense", 1));
        views.setOnClickPendingIntent(R.id.widget_income, quickAdd(context, "kind=income", 2));
    }

    static RemoteViews quick(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_add);
        bindButtons(context, views, prefs);
        return views;
    }

    static RemoteViews summary(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_summary);
        String placeholder = context.getString(R.string.widget_no_data);
        views.setTextViewText(R.id.widget_month, prefs.getString("month", ""));
        views.setTextViewText(R.id.widget_spent_label, prefs.getString("spentLabel", context.getString(R.string.widget_spent)));
        views.setTextViewText(R.id.widget_spent, prefs.getString("spent", placeholder));
        views.setTextViewText(R.id.widget_income_title, prefs.getString("incomeLabel", context.getString(R.string.widget_received)));
        views.setTextViewText(R.id.widget_income_value, prefs.getString("income", placeholder));
        views.setTextViewText(R.id.widget_balance_label, prefs.getString("balanceLabel", context.getString(R.string.widget_balance)));
        views.setTextViewText(R.id.widget_balance, prefs.getString("balance", placeholder));
        views.setOnClickPendingIntent(R.id.widget_header, link(context, HOME, 3));
        views.setOnClickPendingIntent(R.id.widget_totals, link(context, HOME, 4));
        bindButtons(context, views, prefs);
        return views;
    }

    static RemoteViews entry(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_entry);
        views.setTextViewText(R.id.widget_spent_label, prefs.getString("spentLabel", context.getString(R.string.widget_spent)));
        views.setTextViewText(R.id.widget_spent, prefs.getString("spent", context.getString(R.string.widget_no_data)));
        views.setOnClickPendingIntent(R.id.widget_header, link(context, HOME, 5));
        bindButtons(context, views, prefs);
        int shown = 0;
        try {
            JSONArray categories = new JSONArray(prefs.getString("categoriesJson", "[]"));
            for (int i = 0; i < CATEGORY_SLOTS.length; i++) {
                if (i < categories.length()) {
                    JSONObject category = categories.getJSONObject(i);
                    views.setTextViewText(CATEGORY_SLOTS[i], category.optString("name"));
                    views.setOnClickPendingIntent(CATEGORY_SLOTS[i], quickAdd(context, "kind=expense&category=" + Uri.encode(category.optString("id")), 10 + i));
                    views.setViewVisibility(CATEGORY_SLOTS[i], View.VISIBLE);
                    shown++;
                } else {
                    views.setViewVisibility(CATEGORY_SLOTS[i], View.INVISIBLE);
                }
            }
        } catch (JSONException ignored) {
            // Shown again once the app pushes valid data.
        }
        views.setViewVisibility(R.id.widget_categories, shown > 0 ? View.VISIBLE : View.GONE);
        return views;
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] quickIds = manager.getAppWidgetIds(new ComponentName(context, QuickAddWidget.class));
        if (quickIds.length > 0) manager.updateAppWidget(quickIds, quick(context));
        int[] summaryIds = manager.getAppWidgetIds(new ComponentName(context, SummaryWidget.class));
        if (summaryIds.length > 0) manager.updateAppWidget(summaryIds, summary(context));
        int[] entryIds = manager.getAppWidgetIds(new ComponentName(context, QuickEntryWidget.class));
        if (entryIds.length > 0) manager.updateAppWidget(entryIds, entry(context));
    }
}
