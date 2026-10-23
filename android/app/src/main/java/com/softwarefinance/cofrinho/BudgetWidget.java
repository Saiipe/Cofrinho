package com.softwarefinance.cofrinho;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4×2 widget: what is left of the monthly budget, with a progress bar and the daily allowance. */
public class BudgetWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, WidgetRenderer.budget(context));
    }
}
