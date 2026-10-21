package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4×2 widget: the month's spending, income and balance, plus the quick-add buttons. */
public class SummaryWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, WidgetRenderer.summary(context));
    }
}
