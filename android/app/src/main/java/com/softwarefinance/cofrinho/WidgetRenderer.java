package com.softwarefinance.cofrinho;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/** Builds the home-screen widgets from the values last pushed by the app (see CofrinhoPlugin.updateWidgets). */
final class WidgetRenderer {

    static final String PREFS = "cofrinho_widgets";

    private static final String NEW_EXPENSE = "cofrinho://tx/new?kind=expense";
    private static final String NEW_INCOME = "cofrinho://tx/new?kind=income";
    private static final String HOME = "cofrinho://";

    private WidgetRenderer() {}

    private static PendingIntent link(Context context, String url, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void bindButtons(Context context, RemoteViews views, SharedPreferences prefs) {
        views.setTextViewText(R.id.widget_expense_label, prefs.getString("expenseButton", context.getString(R.string.widget_expense)));
        views.setTextViewText(R.id.widget_income_label, prefs.getString("incomeButton", context.getString(R.string.widget_income)));
        views.setOnClickPendingIntent(R.id.widget_expense, link(context, NEW_EXPENSE, 1));
        views.setOnClickPendingIntent(R.id.widget_income, link(context, NEW_INCOME, 2));
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

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] quickIds = manager.getAppWidgetIds(new ComponentName(context, QuickAddWidget.class));
        if (quickIds.length > 0) manager.updateAppWidget(quickIds, quick(context));
        int[] summaryIds = manager.getAppWidgetIds(new ComponentName(context, SummaryWidget.class));
        if (summaryIds.length > 0) manager.updateAppWidget(summaryIds, summary(context));
    }
}
