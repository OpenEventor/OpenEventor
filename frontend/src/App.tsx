import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeModeProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute.tsx';
import { EventLayout } from './components/EventLayout/EventLayout.tsx';
import { LoginPage } from './pages/LoginPage/LoginPage.tsx';
import { EventsListPage } from './pages/EventsListPage/EventsListPage.tsx';
import { CompetitorsPage } from './pages/event/CompetitorsPage/CompetitorsPage.tsx';
import { MonitorPage } from './pages/event/MonitorPage/MonitorPage.tsx';
import { ProtocolsPage } from './pages/event/ProtocolsPage/ProtocolsPage.tsx';
import { DistancesPage } from './pages/event/DistancesPage/DistancesPage.tsx';
import { GroupsPage } from './pages/event/GroupsPage/GroupsPage.tsx';
import { TeamsPage } from './pages/event/TeamsPage/TeamsPage.tsx';
import { PassingsPage } from './pages/event/PassingsPage/PassingsPage.tsx';
import { SettingsPage } from './pages/event/SettingsPage/SettingsPage.tsx';
import { ModulesPage } from './pages/event/ModulesPage/ModulesPage.tsx';

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
          { path: 'monitor', element: <MonitorPage /> },
          { path: 'protocols', element: <ProtocolsPage /> },
          { path: 'distances', element: <DistancesPage /> },
          { path: 'groups', element: <GroupsPage /> },
          { path: 'passings', element: <PassingsPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'modules', element: <ModulesPage /> },
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
