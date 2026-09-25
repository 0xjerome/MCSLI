import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router-dom';
import { RequireAuth, RedirectIfAuthed } from './guards';
import { PublicLayout } from './layouts/PublicLayout';
import { PageLoader } from '@/components/ui/Misc';
import { RouteErrorBoundary } from './RouteErrorBoundary';

// Route-level code splitting: each area is its own chunk so a student on mobile data
// never downloads the admin tools.
const lazyPage = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(loader);
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  );
};

const wrap = (el: ReactNode) => el;

const AppLayout = lazy(() => import('./layouts/AppLayout'));
const TrainerLayout = lazy(() => import('./layouts/TrainerLayout'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout'));

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // ---------------- Public website ----------------
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: lazyPage(() => import('@/pages/public/HomePage')) },
          { path: '/about', element: lazyPage(() => import('@/pages/public/AboutPage')) },
          { path: '/programs', element: lazyPage(() => import('@/pages/public/ProgramsPage')) },
          { path: '/online-learning', element: lazyPage(() => import('@/pages/public/OnlineLearningPage')) },
          { path: '/impact', element: lazyPage(() => import('@/pages/public/ImpactPage')) },
          { path: '/impact/:slug', element: lazyPage(() => import('@/pages/public/StoryPage')) },
          { path: '/stories', element: lazyPage(() => import('@/pages/public/ImpactPage')) },
          { path: '/events', element: lazyPage(() => import('@/pages/public/EventsPage')) },
          { path: '/gallery', element: lazyPage(() => import('@/pages/public/GalleryPage')) },
          { path: '/blog', element: lazyPage(() => import('@/pages/public/ResourcesPage')) },
          { path: '/resources', element: lazyPage(() => import('@/pages/public/ResourcesPage')) },
          { path: '/team', element: lazyPage(() => import('@/pages/public/AboutPage')) },
          { path: '/contact', element: lazyPage(() => import('@/pages/public/ContactPage')) },
          { path: '/donate', element: lazyPage(() => import('@/pages/public/DonatePage')) },
          { path: '/shop', element: lazyPage(() => import('@/pages/public/ShopPage')) },
          { path: '/certificate/:certificateId?', element: lazyPage(() => import('@/pages/public/CertificateVerifyPage')) },
          { path: '/privacy', element: lazyPage(() => import('@/pages/public/PrivacyPage')) },
          { path: '*', element: lazyPage(() => import('@/pages/public/NotFoundPage')) },
        ],
      },
      // ---------------- Auth ----------------
      {
        element: wrap(
          <Suspense fallback={<PageLoader />}>
            <AuthLayout />
          </Suspense>,
        ),
        children: [
          {
            element: <RedirectIfAuthed />,
            children: [
              { path: '/login', element: lazyPage(() => import('@/features/auth/LoginPage')) },
              { path: '/register', element: lazyPage(() => import('@/features/auth/RegisterPage')) },
              { path: '/forgot-password', element: lazyPage(() => import('@/features/auth/ForgotPasswordPage')) },
            ],
          },
          { path: '/reset-password', element: lazyPage(() => import('@/features/auth/ResetPasswordPage')) },
          { path: '/verify-email', element: lazyPage(() => import('@/features/auth/VerifyEmailPage')) },
          { path: '/accept-invite', element: lazyPage(() => import('@/features/auth/AcceptInvitePage')) },
        ],
      },
      // ---------------- Student app ----------------
      {
        element: <RequireAuth minRole="STUDENT" />,
        children: [
          {
            element: (
              <Suspense fallback={<PageLoader />}>
                <AppLayout />
              </Suspense>
            ),
            children: [
              { path: '/app', element: lazyPage(() => import('@/features/student/DashboardPage')) },
              { path: '/app/onboarding', element: lazyPage(() => import('@/features/student/OnboardingPage')) },
              { path: '/app/course', element: lazyPage(() => import('@/features/student/CoursePage')) },
              { path: '/app/course/:courseId', element: lazyPage(() => import('@/features/student/CoursePage')) },
              { path: '/app/course/:courseId/month/:monthId', element: lazyPage(() => import('@/features/student/MonthPage')) },
              { path: '/app/lessons/:lessonId', element: lazyPage(() => import('@/features/student/LessonPage')) },
              { path: '/app/practice', element: lazyPage(() => import('@/features/student/PracticePage')) },
              { path: '/app/quizzes', element: lazyPage(() => import('@/features/student/QuizzesPage')) },
              { path: '/app/quizzes/:quizId', element: lazyPage(() => import('@/features/student/QuizPage')) },
              { path: '/app/assessments', element: lazyPage(() => import('@/features/student/AssessmentsPage')) },
              { path: '/app/exams', element: lazyPage(() => import('@/features/student/ExamsPage')) },
              { path: '/app/exams/:examId', element: lazyPage(() => import('@/features/student/ExamPage')) },
              { path: '/app/discussions', element: lazyPage(() => import('@/features/discussions/DiscussionsPage')) },
              { path: '/app/discussions/:threadId', element: lazyPage(() => import('@/features/discussions/ThreadPage')) },
              { path: '/app/progress', element: lazyPage(() => import('@/features/student/ProgressPage')) },
              { path: '/app/payments', element: lazyPage(() => import('@/features/payments/PaymentsPage')) },
              { path: '/app/certificate', element: lazyPage(() => import('@/features/student/CertificatePage')) },
              { path: '/app/help', element: lazyPage(() => import('@/features/support/HelpPage')) },
              { path: '/app/help/:ticketId', element: lazyPage(() => import('@/features/support/TicketPage')) },
              { path: '/app/notifications', element: lazyPage(() => import('@/features/notifications/NotificationsPage')) },
              { path: '/app/profile', element: lazyPage(() => import('@/features/student/ProfilePage')) },
              { path: '/app/ai', element: lazyPage(() => import('@/features/student/AiComingSoonPage')) },
            ],
          },
        ],
      },
      // ---------------- Trainer ----------------
      {
        element: <RequireAuth exactRoles={['TRAINER', 'ADMIN', 'SUPER_ADMIN']} />,
        children: [
          {
            element: (
              <Suspense fallback={<PageLoader />}>
                <TrainerLayout />
              </Suspense>
            ),
            children: [
              { path: '/trainer', element: lazyPage(() => import('@/features/trainer/TrainerDashboardPage')) },
              { path: '/trainer/students', element: lazyPage(() => import('@/features/trainer/TrainerStudentsPage')) },
              { path: '/trainer/students/:enrollmentId', element: lazyPage(() => import('@/features/staff/EnrollmentDetailPage')) },
              { path: '/trainer/assessments', element: lazyPage(() => import('@/features/trainer/TrainerAssessmentsPage')) },
              { path: '/trainer/reassessments', element: lazyPage(() => import('@/features/trainer/TrainerAssessmentsPage')) },
              { path: '/trainer/quizzes', element: lazyPage(() => import('@/features/trainer/TrainerQuizResultsPage')) },
              { path: '/trainer/exams', element: lazyPage(() => import('@/features/staff/ExamsAdminPage')) },
              { path: '/trainer/exams/:examId', element: lazyPage(() => import('@/features/staff/ExamDetailPage')) },
              { path: '/trainer/discussions', element: lazyPage(() => import('@/features/discussions/DiscussionsPage')) },
              { path: '/trainer/discussions/:threadId', element: lazyPage(() => import('@/features/discussions/ThreadPage')) },
              { path: '/trainer/notifications', element: lazyPage(() => import('@/features/notifications/NotificationsPage')) },
              { path: '/trainer/profile', element: lazyPage(() => import('@/features/student/ProfilePage')) },
            ],
          },
        ],
      },
      // ---------------- Admin ----------------
      {
        element: <RequireAuth minRole="ADMIN" />,
        children: [
          {
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            ),
            children: [
              { path: '/admin', element: lazyPage(() => import('@/features/admin/AdminDashboardPage')) },
              { path: '/admin/students', element: lazyPage(() => import('@/features/admin/AdminStudentsPage')) },
              { path: '/admin/students/:userId', element: lazyPage(() => import('@/features/admin/AdminStudentDetailPage')) },
              { path: '/admin/enrollments/:enrollmentId', element: lazyPage(() => import('@/features/staff/EnrollmentDetailPage')) },
              { path: '/admin/staff', element: lazyPage(() => import('@/features/admin/AdminStaffPage')) },
              { path: '/admin/trainers', element: lazyPage(() => import('@/features/admin/AdminTrainersPage')) },
              { path: '/admin/courses', element: lazyPage(() => import('@/features/admin/AdminCoursesPage')) },
              { path: '/admin/courses/:courseId', element: lazyPage(() => import('@/features/admin/AdminCourseEditorPage')) },
              { path: '/admin/enrollments', element: lazyPage(() => import('@/features/admin/AdminEnrollmentsPage')) },
              { path: '/admin/identity', element: lazyPage(() => import('@/features/admin/AdminIdentityPage')) },
              { path: '/admin/payments', element: lazyPage(() => import('@/features/admin/AdminPaymentsPage')) },
              { path: '/admin/assessments', element: lazyPage(() => import('@/features/trainer/TrainerAssessmentsPage')) },
              { path: '/admin/exams', element: lazyPage(() => import('@/features/staff/ExamsAdminPage')) },
              { path: '/admin/exams/:examId', element: lazyPage(() => import('@/features/staff/ExamDetailPage')) },
              { path: '/admin/certificates', element: lazyPage(() => import('@/features/admin/AdminCertificatesPage')) },
              { path: '/admin/discussions', element: lazyPage(() => import('@/features/discussions/DiscussionsPage')) },
              { path: '/admin/discussions/:threadId', element: lazyPage(() => import('@/features/discussions/ThreadPage')) },
              { path: '/admin/support', element: lazyPage(() => import('@/features/admin/AdminSupportPage')) },
              { path: '/admin/support/:ticketId', element: lazyPage(() => import('@/features/support/TicketPage')) },
              { path: '/admin/content', element: lazyPage(() => import('@/features/admin/AdminContentPage')) },
              { path: '/admin/settings', element: lazyPage(() => import('@/features/admin/AdminSettingsPage')) },
              { path: '/admin/audit', element: lazyPage(() => import('@/features/admin/AdminAuditPage')) },
              { path: '/admin/notifications', element: lazyPage(() => import('@/features/notifications/NotificationsPage')) },
              { path: '/admin/profile', element: lazyPage(() => import('@/features/student/ProfilePage')) },
            ],
          },
        ],
      },
    ],
  },
]);
