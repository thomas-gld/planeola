import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import FeedbackProvider from './components/FeedbackProvider';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Loading from './components/Loading';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgottenPassword = lazy(() => import('./pages/ForgottenPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Home = lazy(() => import('./pages/Home'));
const MemberHome = lazy(() => import('./pages/MemberHome'));
const Members = lazy(() => import('./pages/Members'));
const Planning = lazy(() => import('./pages/Planning'));
const MemberPlanning = lazy(() => import('./pages/MemberPlanning'));
const MemberProfile = lazy(() => import('./pages/MemberProfile'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const MyAvailability = lazy(() => import('./pages/MyAvailability'));
const Options = lazy(() => import('./pages/Options'));
const Organizations = lazy(() => import('./pages/Organizations'));
const Legal = lazy(() => import('./pages/Legal'));

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading fullScreen />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgottenPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/legal" element={<Legal page="legal" />} />
              <Route path="/privacy" element={<Legal page="privacy" />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Organizations />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/member-home"
                element={
                  <ProtectedRoute allowedRoles={['member']}>
                    <MemberHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-availability"
                element={
                  <ProtectedRoute allowedRoles={['member']}>
                    <AppLayout>
                      <MyAvailability />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/member-planning"
                element={
                  <ProtectedRoute allowedRoles={['member']}>
                    <AppLayout>
                      <MemberPlanning />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-profile"
                element={
                  <ProtectedRoute allowedRoles={['member']}>
                    <AppLayout>
                      <MyProfile />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/planning"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Planning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/members"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <Members />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/members/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <MemberProfile />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/options"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <Options />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;
