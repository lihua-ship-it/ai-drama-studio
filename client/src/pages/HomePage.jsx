import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Clapperboard, Clock3, FilePlus2, Film, Sparkles } from 'lucide-react';
import { api } from '../services/api.js';
import { formatDate, parseJson } from '../utils/format.js';
import { ProjectContext } from '../App.jsx';
import PageHeading from '../components/PageHeading.jsx';

export default function HomePage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { selectProject } = useContext(ProjectContext);

  useEffect(() => {
    let active = true;
    api.projects.list().then((result) => { if (active) setProjects(result); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openProject = (project) => {
    selectProject(project.id);
    navigate(`/project/${project.id}`);
  };

  return (
    <div className="home-page page-enter">
      <PageHeading eyebrow="STORY STUDIO / 工作区" title="把故事拍出来。" description="从一句灵感到一部完整短剧，创作进度与生成素材都留在本地。" action={<Link to="/create" className="button button-primary"><FilePlus2 size={16} />新建短剧</Link>} />

      <section className="welcome-band">
        <div className="welcome-copy"><div className="welcome-kicker"><Sparkles size={14} />今日创作</div><h2>让灵感，继续往下走。</h2><p>故事、角色、镜头与声音，在一个连贯的工作台里完成。</p><Link to="/create" className="welcome-link">开启一个新故事 <ArrowUpRight size={15} /></Link></div>
        <div className="welcome-art" aria-hidden="true"><div className="art-frame"><div className="art-sun" /><div className="art-horizon" /><div className="art-cast"><span /><span /><span /></div><div className="art-caption">FRAME 001 · INT. STORY</div></div><div className="art-index">01 <span>/ 灵感板</span></div></div>
      </section>

      <div className="section-bar"><div><span className="section-kicker">YOUR PRODUCTIONS</span><h2>项目库 <span>{projects.length.toString().padStart(2, '0')}</span></h2></div><div className="section-filter"><Clock3 size={14} />最近更新</div></div>

      {error ? <div className="notice notice-error">{error}<span>请确认服务端已启动并完成数据库迁移。</span></div> : null}
      {loading ? <div className="loading-line"><span />正在读取本地项目…</div> : null}
      {!loading && !projects.length && !error ? <div className="empty-projects"><div className="empty-clapper"><Clapperboard size={23} /></div><strong>项目库还空着</strong><span>创建第一部短剧，开始故事开发。</span><Link to="/create" className="button button-secondary">新建项目 <ArrowUpRight size={15} /></Link></div> : null}

      <div className="project-grid">
        {projects.map((project, index) => {
          const progress = parseJson(project.progressJson, {});
          return (
            <button className="project-card" key={project.id} onClick={() => openProject(project)}>
              <div className={`project-art project-art-${index % 3}`}><span className="project-art-label">{project.genre || 'STORY'}</span><Film size={24} strokeWidth={1.2} /><span className="project-art-number">{String(index + 1).padStart(2, '0')}</span></div>
              <div className="project-card-body"><div className="project-card-top"><span className="project-status"><i />{project.status}</span><span className="project-date">{formatDate(project.updatedAt)}</span></div><h3>{project.title}</h3><p>{project.theme}</p><div className="project-card-meta"><span>{project.episodeCount} 集</span><span>{project.durationPerEpisode} 分钟 / 集</span><span>{progress.stage || 'story'}</span></div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}