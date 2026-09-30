import { useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Aperture, FileText, Film, FolderKanban, Image, Plus, Settings2, Sparkles, Workflow } from 'lucide-react';
import { api } from '../services/api.js';
import { ProjectContext } from '../App.jsx';

const navigation = [
  { label: '项目', icon: FolderKanban, to: '/' },
  { label: '剧本', icon: FileText, route: 'script' },
  { label: '角色', icon: Aperture, route: 'characters' },
  { label: '工作台', icon: Workflow, route: 'workbench' }
];

export default function AppShell() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: rememberedProjectId, selectProject } = useContext(ProjectContext);
  const projectId = params.projectId || rememberedProjectId;
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (!projectId) { setProject(null); return; }
    let active = true;
    api.projects.get(projectId).then((snapshot) => {
      if (active) setProject(snapshot.project);
    }).catch(() => { if (active) setProject(null); });
    selectProject(projectId);
    return () => { active = false; };
  }, [projectId, location.pathname]);

  const refreshProject = async () => {
    if (!projectId) return null;
    const snapshot = await api.projects.get(projectId);
    setProject(snapshot.project);
    return snapshot;
  };

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand-lockup">
          <span className="brand-glyph"><Aperture size={19} strokeWidth={1.7} /></span>
          <span><strong>幕间</strong><small>STORY STUDIO</small></span>
        </NavLink>

        <div className="workspace-label">工作区 <span>LOCAL</span></div>
        <button className="project-switcher" onClick={() => navigate('/')}>
          <span className="switcher-mark"><Film size={16} /></span>
          <span className="switcher-text"><strong>{project?.title || '选择项目'}</strong><small>{project ? `${project.genre} · ${project.episodeCount} 集` : '本地创作空间'}</small></span>
          <span className="switcher-caret">⌄</span>
        </button>

        <button className="new-project-link" onClick={() => navigate('/create')}><Plus size={15} /> 新建短剧</button>
        <div className="nav-section-label">制作</div>
        <nav className="main-navigation">
          {navigation.map(({ label, icon: Icon, to, route }) => {
            const target = to || (projectId ? `/${route}/${projectId}` : '/');
            const active = route ? location.pathname.startsWith(`/${route}/`) : location.pathname === '/';
            return (
              <NavLink key={label} to={target} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="engine-status"><span className="status-led" /><div><strong>本地引擎</strong><small>SQLite · Express</small></div><Settings2 size={15} /></div>
          <div className="user-stamp"><div className="avatar-mark">幕</div><div><strong>创作空间</strong><small>桌面工作站</small></div><span className="user-menu">···</span></div>
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div className="breadcrumbs"><span>幕间</span><span className="crumb-divider">/</span><strong>{project?.title || '项目库'}</strong></div>
          <div className="topbar-actions"><span className="autosave"><span />本地数据库已连接</span><span className="topbar-divider" /><button className="icon-button" aria-label="素材"><Image size={17} /></button><button className="topbar-create" onClick={() => navigate('/create')}><Sparkles size={15} /> 开始创作</button></div>
        </header>
        <div className="page-content"><Outlet context={{ projectId: projectId || '', project, refreshProject }} /></div>
      </main>
    </div>
  );
}