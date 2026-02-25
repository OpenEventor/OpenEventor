import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeModeProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute.tsx';
import { EventLayout } from './components/EventLayout/EventLayout.tsx';
import { LoginPage } from './pages/LoginPage/LoginPage.tsx';
import { EventsListPage } from './pages/EventsListPage/EventsListPage.tsx';
import { CompetitorsPage } from './pages/event/CompetitorsPage/CompetitorsPage.tsx';
import { SplitsPage } from './pages/event/SplitsPage/SplitsPage.tsx';
import { GroupsPage } from './pages/event/GroupsPage/GroupsPage.tsx';
import { TeamsPage } from './pages/event/TeamsPage/TeamsPage.tsx';
import { CoursesPage } from './pages/event/CoursesPage/CoursesPage.tsx';
import { PassingsPage } from './pages/event/PassingsPage/PassingsPage.tsx';
import { SettingsPage } from './pages/event/SettingsPage/SettingsPage.tsx';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <EventsListPage /> },
      {
        path: 'events/:eventId',
        element: <EventLayout />,
        children: [
          { index: true, element: <Navigate to="competitors" replace /> },
          { path: 'competitors', element: <CompetitorsPage /> },
          { path: 'splits', element: <SplitsPage /> },
          { path: 'groups', element: <GroupsPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'courses', element: <CoursesPage /> },
          { path: 'passings', element: <PassingsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;
