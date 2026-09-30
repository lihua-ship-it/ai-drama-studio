import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, AudioLines, Check, Clapperboard, FileText, Image, Play, RefreshCw, Sparkles, Users } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { api } from '../services/api.js';
import { parseJson, percent } from '../utils/format.js';

const textStages = ['story', 'characters', 'script', 'storyboard', 'imagePrompts'];

export default function ProjectPage() {
  const { projectId, refreshProject } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activeStage, setActiveStage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!projectId) return;
    try { setSnapshot(await api.projects.get(projectId)); setError(''); }
    catch (reason) { setError(reason.message); }
  };
  useEffect(() => { load(); }, [projectId]);

  const runTextPipeline = async () => {
    if (busy || !snapshot) return;
    setBusy(true);
    setError('');
    try {
      let latest = snapshot;
      const story = latest.project.logline || latest.project.synopsis;
      const characters = latest.characters.length;
      const episodes = latest.episodes.length;
      const shots = latest.shots.length;
      const stages = [];
      if (!story) stages.push('story');
      if (!characters) stages.push('characters');
      if (episodes !== latest.project.episodeCount) stages.push('script');
      if (!shots) stages.push('storyboard');
      if (!shots || latest.shots.some((shot) => !shot.imagePrompt)) stages.push('imagePrompts');
      for (const stage of stages) {
        setActiveStage(stage);
        await api.projects[stage === 'story' ? 'story' : stage === 'characters' ? 'characters' : stage === 'script' ? 'script' : stage === 'storyboard' ? 'storyboard' : 'imagePrompts'](projectId);
        latest = await api.projects.get(projectId);
        setSnapshot(latest);
      }
      await refreshProject();
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); setActiveStage(''); }
  };

  if (error && !snapshot) return <div className="notice notice-error">{error}</div>;
  if (!snapshot) return <div className="loading-line"><span />载入项目内容…</div>;
  const { project, characters, episodes, shots, progress } = snapshot;
  const story = parseJson(project.storyJson, {});
  const stageRows = [
    { label: '故事策划', done: Boolean(project.logline), icon: Sparkles },
    { label: '人物设计', done: characters.length > 0, icon: Users },
    { label: '剧本', done: episodes.length === project.episodeCount, icon: FileText },
    { label: '分镜', done: shots.length > 0, icon: Clapperboard },
    { label: '关键帧', done: progress.totalShots > 0 && progress.keyframes === progress.totalShots, value: `${progress.keyframes}/${progress.totalShots}`, icon: Image },
    { label: '视频', done: progress.totalShots > 0 && progress.videos === progress.totalShots, value: `${progress.videos}/${progress.totalShots}`, icon: Play },
    { label: '配音', done: shots.length > 0 && shots.every((shot) => shot.audioStatus === 'succeeded'), value: `${progress.speech}`, icon: AudioLines }
  ];
  const completed = stageRows.filter((stage) => stage.done).length;

  return (
    <div className="project-page page-enter">
      <PageHeading eyebrow={`${project.genre} / ${project.episodeCount} EPISODES`} title={project.title} description={project.theme} action={<button className="button button-primary" disabled={busy} onClick={runTextPipeline}>{busy ? <><span className="button-spinner" />{activeStage || '生成中'}</> : <><Sparkles size={15} />{completed < 4 ? '继续文本创作' : '更新文本内容'}</>}</button>} />
      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="project-overview-grid">
        <section className="progress-panel panel">
          <div className="panel-heading"><div><span className="section-kicker">PRODUCTION FLOW</span><h2>制作进度 <span>{completed} / {stageRows.length}</span></h2></div><div className="progress-orbit">{percent(completed, stageRows.length)}<small>%</small></div></div>
          <div className="progress-track"><span style={{ width: `${percent(completed, stageRows.length)}%` }} /></div>
          <div className="stage-list">{stageRows.map(({ label, done, value, icon: Icon }, index) => <div className={`stage-row ${done ? 'done' : ''}`} key={label}><span className="stage-check">{done ? <Check size={13} /> : <Icon size={14} />}</span><span className="stage-name">{label}</span>{value ? <span className="stage-value">{value}</span> : <span className="stage-state">{done ? '完成' : index === completed ? '待继续' : '待开始'}</span>}</div>)}</div>
          <div className="progress-footer"><span><i className="status-led" />本地 SQLite 持久化</span><span>{progress.activeTasks} 个活动任务</span></div>
        </section>

        <section className="story-note panel">
          <div className="section-kicker">STORY NOTE</div><div className="story-note-title">一句话故事</div>
          <blockquote>{project.logline || '故事策划尚未生成。'}</blockquote>
          <div className="story-note-rule" />
          <div className="story-note-title">故事简介</div><p>{project.synopsis || '生成故事策划后，简介会显示在这里。'}</p>
          <div className="story-note-meta"><span>{project.durationPerEpisode} 分钟 / 集</span><span>{characters.length} 位角色</span><span>{shots.length} 个镜头</span></div>
        </section>
      </div>

      <div className="section-bar project-section-bar"><div><span className="section-kicker">NEXT SCENES</span><h2>制作空间</h2></div><Link to={`/workbench/${projectId}`} className="quiet-link">打开工作台 <ArrowRight size={14} /></Link></div>
      <div className="workspace-links">
        <Link to={`/script/${projectId}`} className="workspace-link"><span className="workspace-link-icon"><FileText size={18} /></span><strong>剧本</strong><small>{episodes.length} 集 · {story.synopsis ? '已生成' : '待生成'}</small><ArrowRight size={15} /></Link>
        <Link to={`/characters/${projectId}`} className="workspace-link"><span className="workspace-link-icon"><Users size={18} /></span><strong>人物</strong><small>{characters.length} 位 · 参考图与音色</small><ArrowRight size={15} /></Link>
        <Link to={`/workbench/${projectId}`} className="workspace-link"><span className="workspace-link-icon"><Clapperboard size={18} /></span><strong>工作台</strong><small>{shots.length} 镜 · 分镜 · 素材 · 成片</small><ArrowRight size={15} /></Link>
      </div>
    </div>
  );
}