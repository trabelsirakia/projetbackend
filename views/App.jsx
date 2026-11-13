import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { PrivateRoute, PublicOnlyRoute, RoleRoute } from './routes/guards';
import FullPageLoader from './components/ui/FullPageLoader';
import Landing from './pages/Landing';
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/auth/AuthPages';

// Pages chargées à la demande : la page d'accueil reste légère.
const Offers = lazy(() => import('./pages/jobs/Offers'));
const OfferDetail = lazy(() => import('./pages/jobs/OfferDetail'));
const MyApplications = lazy(() => import('./pages/candidate/MyApplications'));
const ApplicationDetail = lazy(() => import('./pages/candidate/ApplicationDetail'));
const QuizPage = lazy(() => import('./pages/candidate/QuizPage'));
const InterviewRoom = lazy(() => import('./pages/candidate/InterviewRoom'));
const Profile = lazy(() => import('./pages/Profile'));
const Dashboard = lazy(() => import('./pages/recruiter/Dashboard'));
const JobsManage = lazy(() => import('./pages/recruiter/JobsManage'));
const Applications = lazy(() => import('./pages/recruiter/Applications'));
const Quizzes = lazy(() => import('./pages/recruiter/Quizzes'));
const QuizEditor = lazy(() => import('./pages/recruiter/QuizEditor'));
const Interviews = lazy(() => import('./pages/recruiter/Interviews'));
const InterviewReview = lazy(() => import('./pages/recruiter/InterviewReview'));
const Users = lazy(() => import('./pages/admin/Users'));
const NotFound = lazy(() => import('./pages/NotFound'));

const STAFF = ['recruteur', 'admin'];

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Landing />} />
          <Route path="offres" element={<Offers />} />
          <Route path="offres/:id" element={<OfferDetail />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="inscription" element={<Signup />} />
            <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
          </Route>
          <Route path="reinitialiser-mot-de-passe" element={<ResetPassword />} />

          <Route element={<PrivateRoute />}>
            <Route path="profil" element={<Profile />} />
            <Route element={<RoleRoute roles={['candidat']} />}>
              <Route path="mes-candidatures" element={<MyApplications />} />
              <Route path="mes-candidatures/:id" element={<ApplicationDetail />} />
              <Route path="quiz/:applicationId" element={<QuizPage />} />
              <Route path="entretien/:id" element={<InterviewRoom />} />
            </Route>
            <Route element={<RoleRoute roles={STAFF} />}>
              <Route path="recruteur" element={<Dashboard />} />
              <Route path="recruteur/offres" element={<JobsManage />} />
              <Route path="recruteur/candidatures" element={<Applications />} />
              <Route path="recruteur/quiz" element={<Quizzes />} />
              <Route path="recruteur/quiz/nouveau" element={<QuizEditor />} />
              <Route path="recruteur/quiz/:id" element={<QuizEditor />} />
              <Route path="recruteur/entretiens" element={<Interviews />} />
              <Route path="recruteur/entretiens/:id" element={<InterviewReview />} />
            </Route>
            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="admin/utilisateurs" element={<Users />} />
            </Route>
          </Route>
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
