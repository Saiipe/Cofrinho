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

    // ---------- Gradient widgets: budget, goals, upcoming, wealth ----------

    private static final int[] ROWS = { R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3 };
    private static final int[] NAMES = { R.id.widget_name_1, R.id.widget_name_2, R.id.widget_name_3 };
    private static final int[] VALUES = { R.id.widget_value_1, R.id.widget_value_2, R.id.widget_value_3 };

    /** The JSON object the app pushed under `key`, or an empty one before the first push. */
    private static JSONObject data(Context context, String key) {
        try {
            return new JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /** Shows the content or the empty message (with the app's own text when it pushed one). */
    private static void showContent(RemoteViews views, JSONObject json, boolean hasContent) {
        views.setViewVisibility(R.id.widget_content, hasContent ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_empty, hasContent ? View.GONE : View.VISIBLE);
        String empty = json.optString("empty");
        if (!empty.isEmpty()) views.setTextViewText(R.id.widget_empty, empty);
    }

    static RemoteViews budget(Context context) {
        JSONObject json = data(context, "budgetJson");
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_budget);
        views.setOnClickPendingIntent(R.id.widget_root, link(context, HOME + "budget", 20));
        views.setTextViewText(R.id.widget_title, json.optString("title"));
        boolean has = json.optBoolean("hasBudget");
        showContent(views, json, has);
        if (!has) return views;
        boolean over = json.optBoolean("over");
        views.setTextViewText(R.id.widget_budget_label, json.optString("label"));
        views.setTextViewText(R.id.widget_budget_available, json.optString("available"));
        views.setTextViewText(R.id.widget_budget_spent, json.optString("spentLine"));
        views.setTextViewText(R.id.widget_budget_per_day, json.optString("perDay"));
        views.setProgressBar(R.id.widget_budget_progress, 100, json.optInt("percent"), false);
        views.setViewVisibility(R.id.widget_budget_progress, over ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_budget_progress_over, over ? View.VISIBLE : View.GONE);
        return views;
    }

    static RemoteViews goals(Context context) {
        JSONObject json = data(context, "goalsJson");
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
        views.setOnClickPendingIntent(R.id.widget_root, link(context, HOME + "goals", 21));
        JSONArray items = json.optJSONArray("items");
        int count = items == null ? 0 : items.length();
        showContent(views, json, count > 0);
        int[] lines = { R.id.widget_line_1, R.id.widget_line_2, R.id.widget_line_3 };
        int[] bars = { R.id.widget_progress_1, R.id.widget_progress_2, R.id.widget_progress_3 };
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject item = i < count ? items.optJSONObject(i) : null;
            views.setViewVisibility(ROWS[i], item != null ? View.VISIBLE : View.INVISIBLE);
            if (item == null) continue;
            int percent = item.optInt("percent");
            views.setTextViewText(NAMES[i], item.optString("name"));
            views.setTextViewText(lines[i], item.optString("line"));
            views.setTextViewText(VALUES[i], percent + "%");
            views.setProgressBar(bars[i], 100, percent, false);
        }
        return views;
    }

    static RemoteViews upcoming(Context context) {
        JSONObject json = data(context, "upcomingJson");
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming);
        views.setOnClickPendingIntent(R.id.widget_root, link(context, HOME + "calendar", 22));
        JSONArray items = json.optJSONArray("items");
        int count = items == null ? 0 : items.length();
        showContent(views, json, count > 0);
        int[] days = { R.id.widget_day_1, R.id.widget_day_2, R.id.widget_day_3 };
        int[] months = { R.id.widget_month_1, R.id.widget_month_2, R.id.widget_month_3 };
        int[] lines = { R.id.widget_line_1, R.id.widget_line_2, R.id.widget_line_3 };
        int income = context.getColor(R.color.widget_income_on_gradient);
        int plain = context.getColor(R.color.widget_on_gradient);
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject item = i < count ? items.optJSONObject(i) : null;
            views.setViewVisibility(ROWS[i], item != null ? View.VISIBLE : View.INVISIBLE);
            if (item == null) continue;
            views.setTextViewText(days[i], item.optString("day"));
            views.setTextViewText(months[i], item.optString("month"));
            views.setTextViewText(NAMES[i], item.optString("name"));
            views.setTextViewText(lines[i], item.optString("when"));
            views.setTextViewText(VALUES[i], item.optString("amount"));
            views.setTextColor(VALUES[i], item.optBoolean("income") ? income : plain);
        }
        return views;
    }

    static RemoteViews wealth(Context context) {
        JSONObject json = data(context, "wealthJson");
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_wealth);
        views.setOnClickPendingIntent(R.id.widget_root, link(context, HOME + "accounts", 23));
        showContent(views, json, json.optBoolean("hasAccounts"));
        views.setTextViewText(R.id.widget_wealth_label, json.optString("label", context.getString(R.string.widget_wealth_total)));
        views.setTextViewText(R.id.widget_wealth_total, json.optString("total", context.getString(R.string.widget_no_data)));
        String yield = json.optString("yieldLine");
        views.setTextViewText(R.id.widget_wealth_yield, yield.isEmpty() ? "" : "↗ " + yield);
        views.setViewVisibility(R.id.widget_wealth_yield, yield.isEmpty() ? View.GONE : View.VISIBLE);
        JSONArray items = json.optJSONArray("items");
        int count = items == null ? 0 : items.length();
        views.setViewVisibility(R.id.widget_tiles, count > 0 ? View.VISIBLE : View.GONE);
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject item = i < count ? items.optJSONObject(i) : null;
            // Missing tiles collapse so the others share the width.
            views.setViewVisibility(ROWS[i], item != null ? View.VISIBLE : View.GONE);
            if (item == null) continue;
            views.setTextViewText(NAMES[i], item.optString("name"));
            views.setTextViewText(VALUES[i], item.optString("value"));
        }
        return views;
    }

    private static void update(AppWidgetManager manager, Context context, Class<?> provider, RemoteViews views) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        if (ids.length > 0) manager.updateAppWidget(ids, views);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] quickIds = manager.getAppWidgetIds(new ComponentName(context, QuickAddWidget.class));
        if (quickIds.length > 0) manager.updateAppWidget(quickIds, quick(context));
        int[] summaryIds = manager.getAppWidgetIds(new ComponentName(context, SummaryWidget.class));
        if (summaryIds.length > 0) manager.updateAppWidget(summaryIds, summary(context));
        int[] entryIds = manager.getAppWidgetIds(new ComponentName(context, QuickEntryWidget.class));
        if (entryIds.length > 0) manager.updateAppWidget(entryIds, entry(context));
        update(manager, context, BudgetWidget.class, budget(context));
        update(manager, context, GoalsWidget.class, goals(context));
        update(manager, context, UpcomingWidget.class, upcoming(context));
        update(manager, context, WealthWidget.class, wealth(context));
    }
}
