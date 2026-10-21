import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router';
import { BottomNav } from './app/BottomNav';
import { Lifecycle } from './app/Lifecycle';
import { LongPressTooltip } from './components/LongPressTooltip';
import { UpdateNotes } from './components/ReleaseNotes';
import { PageFallback } from './components/Splash';
import HomeScreen from './screens/HomeScreen';
import QuickAddScreen from './screens/QuickAddScreen';
import TransactionFormScreen from './screens/TransactionFormScreen';

function page(loader: () => Promise<{ default: ComponentType }>) {
  const Screen = lazy(loader);
  return <Screen />;
}

function RootLayout() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
      <Lifecycle />
      <LongPressTooltip />
      <UpdateNotes />
      <ScrollRestoration />
    </>
  );
}

function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <TabsLayout />,
        children: [
          { index: true, element: <HomeScreen /> },
          { path: 'charts', element: page(() => import('./screens/ChartsScreen')) },
          { path: 'reports', element: page(() => import('./screens/ReportsScreen')) },
          { path: 'me', element: page(() => import('./screens/MeScreen')) },
        ],
      },
      { path: 'tx/new', element: <TransactionFormScreen /> },
      { path: 'quick', element: <QuickAddScreen /> },
      { path: 'tx/:id', element: page(() => import('./screens/TransactionDetailScreen')) },
      { path: 'tx/:id/edit', element: <TransactionFormScreen /> },
      { path: 'search', element: page(() => import('./screens/SearchScreen')) },
      { path: 'calendar', element: page(() => import('./screens/CalendarScreen')) },
      { path: 'budget', element: page(() => import('./screens/BudgetScreen')) },
      { path: 'accounts', element: page(() => import('./screens/AccountsScreen')) },
      { path: 'accounts/new', element: page(() => import('./screens/AccountFormScreen')) },
      { path: 'accounts/:id', element: page(() => import('./screens/AccountDetailScreen')) },
      { path: 'accounts/:id/edit', element: page(() => import('./screens/AccountFormScreen')) },
      { path: 'categories', element: page(() => import('./screens/CategoriesScreen')) },
      { path: 'categories/new', element: page(() => import('./screens/CategoryFormScreen')) },
      { path: 'categories/:id/edit', element: page(() => import('./screens/CategoryFormScreen')) },
      { path: 'books', element: page(() => import('./screens/BooksScreen')) },
      { path: 'books/new', element: page(() => import('./screens/BookFormScreen')) },
      { path: 'books/:id/edit', element: page(() => import('./screens/BookFormScreen')) },
      { path: 'settle', element: page(() => import('./screens/SettleScreen')) },
      { path: 'recurring', element: page(() => import('./screens/RecurringScreen')) },
      { path: 'recurring/new', element: page(() => import('./screens/RecurringFormScreen')) },
      { path: 'recurring/:id/edit', element: page(() => import('./screens/RecurringFormScreen')) },
      { path: 'reminders', element: page(() => import('./screens/RemindersScreen')) },
      { path: 'currencies', element: page(() => import('./screens/CurrenciesScreen')) },
      { path: 'import', element: page(() => import('./screens/ImportScreen')) },
      { path: 'export', element: page(() => import('./screens/ExportScreen')) },
      { path: 'backup', element: page(() => import('./screens/BackupScreen')) },
      { path: 'tags', element: page(() => import('./screens/TagsScreen')) },
      { path: 'cards', element: page(() => import('./screens/CardsScreen')) },
      { path: 'goals', element: page(() => import('./screens/GoalsScreen')) },
      { path: 'goals/new', element: page(() => import('./screens/GoalFormScreen')) },
      { path: 'goals/:id', element: page(() => import('./screens/GoalDetailScreen')) },
      { path: 'goals/:id/edit', element: page(() => import('./screens/GoalFormScreen')) },
      { path: 'shortcuts', element: page(() => import('./screens/ShortcutsScreen')) },
      { path: 'whats-new', element: page(() => import('./screens/WhatsNewScreen')) },
      { path: 'settings', element: page(() => import('./screens/SettingsScreen')) },
      { path: 'settings/lock', element: page(() => import('./screens/LockSettingsScreen')) },
      { path: 'garden', element: page(() => import('./screens/GardenScreen')) },
      { path: 'about', element: page(() => import('./screens/AboutScreen')) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
