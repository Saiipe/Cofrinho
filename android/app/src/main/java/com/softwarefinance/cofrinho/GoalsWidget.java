package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4×3 widget: progress of up to three goals. */
public class GoalsWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, WidgetRenderer.goals(context));
    }
}
