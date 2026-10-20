import { RouterProvider } from 'react-router';
import { AppProvider } from './app/AppContext';
import { BookProvider } from './app/BookContext';
import { LockGate } from './app/LockGate';
import { FeedbackProvider } from './components/feedback';
import { Splash } from './components/Splash';
import { router } from './router';
import OnboardingScreen from './screens/OnboardingScreen';

export function App() {
  return (
    <AppProvider splash={<Splash />}>
      <FeedbackProvider>
        <LockGate>
          <BookProvider fallback={(state) => (state === 'empty' ? <OnboardingScreen /> : <Splash />)}>
            <RouterProvider router={router} />
          </BookProvider>
        </LockGate>
      </FeedbackProvider>
    </AppProvider>
  );
}
