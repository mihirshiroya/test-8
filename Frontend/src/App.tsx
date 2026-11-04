
import React from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import NotchNavbar from "./pages/Notch";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { useTheme } from './context/ThemeContext';
import TaskTimerEngine from './pages/TaskEngine';
import {
  PersistGate,
} from 'redux-persist/integration/react';

import { store, persistor } from './store';

import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';



import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Security from './pages/Security';
import ForgotPassword from './pages/ForgetPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import AuthSuccess from './pages/AuthSuccess';

import AdminDashboard from './pages/AdminDashboard';
import UsersManagement from './pages/UsersManagement';
import UserDetail from './pages/UserDetail';

import Calender from './pages/Calender';

import { ActivityDialog } from './components/Ui/activity-dialog';
import { AppSidebar } from './pages/AppSidebar';

import { ThemeProvider } from './context/ThemeContext';

import Profile2 from './pages/Profile2';
import { Notes } from './pages/Notes';
import Kanban from './pages/Kanban';

import {
  ProjectPage,
} from './pages/workspacepages';

import Overview from './pages/Overview';

import {
  SessionHistory,
} from './components/Ui/session-history';

import DocsViewer from './pages/docs-viewer';
import DocsWorkspace from './pages/docs-workspace';

import { IS_DESKTOP } from './lib/api-origin';
import { DesktopGate } from './desktop/DesktopGate';
import { DesktopBridge } from './desktop/DesktopBridge';
import DesktopSettings from './desktop/DesktopSettings';
import { DesktopTitleBar } from './desktop/DesktopTitleBar';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Re-mounting a screen within 30s reuses cached data instead of refetching.
      staleTime: 30_000,
    },
  },
});


/* ============================================================
   FULL SCREEN DOCS LAYOUT

   Docs are intentionally outside AppSidebar.

   This gives:
   - 100vw width
   - 100vh height
   - no dashboard sidebar
   - no normal app layout spacing
   - independent scrolling
   ============================================================ */

const DocsLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        h-screen
        w-screen
        overflow-hidden
        bg-background
      "
    >
      {children}
    </div>
  );
};



/* ============================================================
   THEMED TOASTER

   Reads the app's light/dark theme and passes it to Sonner
   so toast colours always match the current colour scheme.
   ============================================================ */

const ThemedToaster: React.FC = () => {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      visibleToasts={4}
      gap={12}
      offset={20}
      theme={theme}
      style={{ '--width': '400px' } as React.CSSProperties}
      toastOptions={{ unstyled: true, className: 'w-full' }}
    />
  );
};


const AppContent: React.FC = () => {
  return (
    <Router>
      <div className="App min-h-screen w-full">

        <DesktopBridge />

        {/* =====================================================
            FIXED TOP-CENTER NOTCH NAVBAR
            ===================================================== */}
        <NotchNavbar />

        <Routes>

          {/* =====================================================
              ROOT
              / -> /login (which forwards authenticated users to /overview)
              ===================================================== */}
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />

          {/* =====================================================
              FULL SCREEN DOCUMENTATION SYSTEM
              ===================================================== */}

          <Route
            path="/notes/:folderId"
            element={
              <ProtectedRoute>
                <DocsLayout>
                  <DocsViewer />
                </DocsLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/notes/:folderId/edit"
            element={
              <ProtectedRoute>
                <DocsLayout>
                  <DocsWorkspace />
                </DocsLayout>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              NORMAL APPLICATION WORKSPACE
              ===================================================== */}

          <Route
            element={
              <ProtectedRoute>
                <AppSidebar />
              </ProtectedRoute>
            }
          >

            <Route
              path="/overview"
              element={<Overview />}
            />

            <Route
              path="/notes"
              element={<Notes />}
            />

            <Route
              path="/Calender"
              element={<Calender />}
            />

            <Route
              path="/session"
              element={<SessionHistory />}
            />

            <Route
              path="/kanban"
              element={<Kanban />}
            />

            <Route
              path="/projects/:projectSlug"
              element={<ProjectPage />}
            />

            <Route
              path="/profile"
              element={<Profile2 />}
            />

            {IS_DESKTOP && (
              <Route
                path="/settings/desktop"
                element={<DesktopSettings />}
              />
            )}

          </Route>

          {/* =====================================================
              AUTH
              ===================================================== */}

          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <Login />
              </ProtectedRoute>
            }
          />

          <Route
            path="/register"
            element={
              <ProtectedRoute requireAuth={false}>
                <Register />
              </ProtectedRoute>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <ProtectedRoute requireAuth={false}>
                <ForgotPassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="/auth/success"
            element={
              <ProtectedRoute requireAuth={false}>
                <AuthSuccess />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reset-password"
            element={
              <ProtectedRoute requireAuth={false}>
                <ResetPassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="/verify-email"
            element={
              <VerifyEmail />
            }
          />

          {/* =====================================================
              OLD ACCOUNT APP
              ===================================================== */}

          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              path="profile"
              element={<Profile />}
            />

            <Route
              path="security"
              element={<Security />}
            />
          </Route>

          {/* =====================================================
              ADMIN
              ===================================================== */}

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UsersManagement />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users/:id"
            element={
              <AdminRoute>
                <UserDetail />
              </AdminRoute>
            }
          />

          {/* =====================================================
              FALLBACK
              ===================================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

        </Routes>
      </div>
    </Router>
  );
};


const App: React.FC = () => {
  return (
    <Provider store={store}>

      <PersistGate
        loading={null}
        persistor={persistor}
      >


          <QueryClientProvider client={queryClient}>

            <ThemeProvider>

              {IS_DESKTOP && <DesktopTitleBar />}

              <DesktopGate>
                <ActivityDialog />
                <TaskTimerEngine />

                <AppContent />
              </DesktopGate>

              <ThemedToaster />

              <ReactQueryDevtools
                initialIsOpen={false}
              />

            </ThemeProvider>

          </QueryClientProvider>



      </PersistGate>

    </Provider>
  );
};


export default App;

