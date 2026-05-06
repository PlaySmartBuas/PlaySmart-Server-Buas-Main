import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login';
import SignUp from './pages/SignUp';
import GameSelection from './pages/GameSelection';
import PlayerLayout from './components/layout/playerlayout';
import CoachLayout from './components/layout/coachlayout';
import PlayerLoLFeedbackReview from './pages/player/LoLfeedbackreview';
import PlayerValorantFeedbackReview from './pages/player/Valorantfeedbackreview';
import ToolkitSetup from './pages/player/toolkitsetup';
import ValorantDashboard from './pages/player/ValorantDashboard';
import LoLDashboard from './pages/player/LoLDashboard';

import ValorantRecordingList from './pages/coach/ValorantRecordingList';
import LoLRecordingList from './pages/coach/LoLRecordingList';

import PlayerValorantRecordingList from './pages/player/ValorantRecordingList';
import PlayerLoLRecordingList from './pages/player/LoLRecordingList';

import PlayerValorantMatchDashboard from './pages/player/ValorantMatchDashboard';
import PlayerLoLMatchDashboard from './pages/player/LoLMatchDashboard';

import CoachLoLRecordingAnalysis from './pages/coach/LoLrecordinganalysis';
import CoachValorantRecordingAnalysis from './pages/coach/Valorantrecordinganalysis';

import ValorantMatchDashboard from './pages/coach/ValorantMatchDashboard';
import LoLMatchDashboard from './pages/coach/LoLMatchDashboard';

import CoachValorantDashboard from './pages/coach/ValorantDashboard';
import CoachLoLDashboard from './pages/coach/LoLDashboard';

import { isAuthenticated } from './utils/auth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        <Route
          path="/game-selection"
          element={
            <ProtectedRoute>
              <GameSelection />
            </ProtectedRoute>
          }
        />

        <Route
          path="/player/valorant-dashboard"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <ValorantDashboard />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/lol-dashboard"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <LoLDashboard />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />

        {/* FIXED: Added /:filename parameter */}
        <Route
          path="/player/lol-feedbackreview/:filename"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerLoLFeedbackReview />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        {/* FIXED: Added /:filename parameter */}
        <Route
          path="/player/valorant-feedbackreview/:filename"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerValorantFeedbackReview />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/valorant-matchdashboard"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerValorantMatchDashboard />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/lol-matchdashboard"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerLoLMatchDashboard />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/toolkitsetup"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <ToolkitSetup />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/valorant-recordinglist"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerValorantRecordingList />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/lol-recordinglist"
          element={
            <ProtectedRoute>
              <PlayerLayout>
                <PlayerLoLRecordingList />
              </PlayerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach/valorant-dashboard"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <CoachValorantDashboard />
              </CoachLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/lol-dashboard"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <CoachLoLDashboard />
              </CoachLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach/valorant-recordinganalysis"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <ValorantRecordingList />
              </CoachLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/lol-recordinganalysis"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <LoLRecordingList />
              </CoachLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach/valorant-recording-analysis"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <CoachValorantRecordingAnalysis />
              </CoachLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/lol-recording-analysis"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <CoachLoLRecordingAnalysis />
              </CoachLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/valorant-match-dashboard"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <ValorantMatchDashboard />
              </CoachLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/lol-match-dashboard"
          element={
            <ProtectedRoute>
              <CoachLayout>
                <LoLMatchDashboard />
              </CoachLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirects */}
        <Route path="/player" element={<Navigate to="/game-selection" />} />
        <Route path="/player/dashboard" element={<Navigate to="/game-selection" />} />
        <Route path="/coach" element={<Navigate to="/game-selection" />} />
        <Route path="/coach/dashboard" element={<Navigate to="/game-selection" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;