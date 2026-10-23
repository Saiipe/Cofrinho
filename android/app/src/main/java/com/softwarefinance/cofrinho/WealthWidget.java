package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4×2 widget: net worth, investment yield and the main accounts. */
public class WealthWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, WidgetRenderer.wealth(context));
    }
}
