package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4×3 widget: the next recurring records (forecasts). */
public class UpcomingWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, WidgetRenderer.upcoming(context));
    }
}
