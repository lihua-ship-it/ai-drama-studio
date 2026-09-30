import { createContext, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ScriptPage from './pages/ScriptPage.jsx';
import CharactersPage from './pages/CharactersPage.jsx';
import StoryboardPage from './pages/StoryboardPage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import FinalPage from './pages/FinalPage.jsx';

export const ProjectContext = createContext(null);

export default function App() {
  const [projectId, setProjectId] = useState(localStorage.getItem('ai-drama-project') || '');
  const selectProject = (id) => {
    setProjectId(id);
    if (id) localStorage.setItem('ai-drama-project', id);
    else localStorage.removeItem('ai-drama-project');
  };

  return (
    <ProjectContext.Provider value={{ projectId, selectProject }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="project/:projectId" element={<ProjectPage />} />
          <Route path="script/:projectId" element={<ScriptPage />} />
          <Route path="characters/:projectId" element={<CharactersPage />} />
          <Route path="storyboard/:projectId" element={<StoryboardPage />} />
          <Route path="assets/:projectId" element={<AssetsPage />} />
          <Route path="final/:projectId" element={<FinalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ProjectContext.Provider>
  );
}