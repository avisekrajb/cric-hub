import { lazy, Suspense, useEffect } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { PageLoader } from "./components/common/States";
import AdminShell, { AdminGuard } from "./admin/AdminShell";

const Home = lazy(() => import("./pages/Home"));
const LiveStream = lazy(() => import("./pages/LiveStream"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const Matches = lazy(() => import("./pages/Matches"));
const Videos = lazy(() => import("./pages/Videos"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const Stats = lazy(() => import("./pages/Stats"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminOps = lazy(() => import("./admin/AdminOps"));
const AdminMatches = lazy(() => import("./admin/AdminMatches"));
const AdminMatchForm = lazy(() => import("./admin/AdminMatchForm"));
const AdminScoreConsole = lazy(() => import("./admin/AdminScoreConsole"));
const AdminStreams = lazy(() => import("./admin/AdminStreams"));
const AdminTeams = lazy(() => import("./admin/AdminTeams"));
const AdminPlayers = lazy(() => import("./admin/AdminPlayers"));
const AdminCountries = lazy(() => import("./admin/AdminCountries"));
const AdminMedia = lazy(() => import("./admin/AdminMedia"));
const AdminSettings = lazy(() => import("./admin/AdminSettings"));

function PublicLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("bethub:ready")));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/live" element={<LiveStream />} />
          <Route path="/live/:slug" element={<LiveStream />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route index element={<AdminDashboard />} />
            <Route path="ops" element={<AdminOps />} />
            <Route path="matches" element={<AdminMatches />} />
            <Route path="matches/new" element={<AdminMatchForm />} />
            <Route path="matches/:id/edit" element={<AdminMatchForm />} />
            <Route path="matches/:id/score" element={<AdminScoreConsole />} />
            <Route path="streams" element={<AdminStreams />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="countries" element={<AdminCountries />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
