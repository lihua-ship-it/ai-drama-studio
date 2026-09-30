import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, ChevronDown, Clapperboard, FileText, Film, Image, LoaderCircle, RefreshCw, Sparkles, Users } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import ShotCard from '../components/ShotCard.jsx';
import { api } from '../services/api.js';
import { mediaUrl } from '../utils/format.js';

// 成片预览阶段最多一次性渲染的视频数，避免数据量大时卡死主线程。
const MAX_FINAL_VIDEOS = 8;
// 一键串行生成期间的温和刷新间隔（毫秒）。
const RUN_ALL_POLL_MS = 6000;

export default function WorkbenchPage() {
  const { projectId } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [busyStage, setBusyStage] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState('');
  const [open, setOpen] = useState({});
  const [selectedShotId, setSelectedShotId] = useState('');
  const initializedRef = useRef(false);

  const load = async () => {
    if (!projectId) return;
    try {
      setSnapshot(await api.projects.get(projectId));
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  };
  useEffect(() => { load(); }, [projectId]);

  // 仅在一键串行生成期间温和刷新快照，平时不做全量轮询。
  useEffect(() => {
    if (!running || !projectId) return undefined;
    const timer = setInterval(async () => {
      try {
        setSnapshot(await api.projects.get(projectId));
        setError('');
      } catch (reason) {
        setError(reason.message);
      }
    }, RUN_ALL_POLL_MS);
    return () => clearInterval(timer);
  }, [running, projectId]);

  const sortedShots = useMemo(() => {
    const shots = snapshot?.shots || [];
    return [...shots].sort((left, right) =>
      (left.episode?.episodeNumber ?? 0) - (right.episode?.episodeNumber ?? 0) ||
      (left.scene?.sceneNumber ?? 0) - (right.scene?.sceneNumber ?? 0) ||
      (left.shotNumber ?? 0) - (right.shotNumber ?? 0)
    );
  }, [snapshot]);

  // 保证镜头选择器始终指向一个有效镜头；默认选中第一个。
  useEffect(() => {
    if (!sortedShots.length) { setSelectedShotId(''); return; }
    if (!sortedShots.some((shot) => shot.id === selectedShotId)) setSelectedShotId(sortedShots[0].id);
  }, [sortedShots, selectedShotId]);

  // 首次加载后初始化折叠状态：已完成阶段折叠，未完成/当前阶段展开。
  useEffect(() => {
    if (!snapshot || initializedRef.current) return;
    initializedRef.current = true;
    const project = snapshot.project || {};
    const characters = snapshot.characters || [];
    const episodes = snapshot.episodes || [];
    const shots = snapshot.shots || [];
    const done = {
      story: Boolean(project.logline || project.synopsis),
      characters: characters.length > 0,
      script: episodes.length >= project.episodeCount && shots.length > 0,
      assets: shots.length > 0 && shots.every((shot) => shot.imagePath && shot.videoPath)
    };
    const firstIncomplete = ['story', 'characters', 'script', 'assets'].find((key) => !done[key]);
    setOpen({ [firstIncomplete || 'final']: true });
  }, [snapshot]);

  const toggle = (key) => setOpen((previous) => ({ ...previous, [key]: !previous[key] }));

  const generateStory = async () => {
    if (busyStage) return;
    setBusyStage('story'); setError('');
    try { await api.projects.story(projectId); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusyStage(''); }
  };

  const generateCharacters = async () => {
    if (busyStage) return;
    setBusyStage('characters'); setError('');
    try { await api.projects.characters(projectId); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusyStage(''); }
  };

  const generateScript = async () => {
    if (busyStage) return;
    setBusyStage('script'); setError('');
    try {
      await api.projects.script(projectId);
      await api.projects.storyboard(projectId);
      await api.projects.imagePrompts(projectId);
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusyStage(''); }
  };

  // 一键串行生成：fire-and-forget 发起长任务，期间由上方轮询 effect 温和刷新。
  const startRunAll = () => {
    if (running) return;
    setRunning(true);
    setRunError('');
    setRunResult(null);
    api.projects.runAll(projectId, ['images', 'videos'])
      .then(async (result) => { setRunResult(result); await load(); })
      .catch((reason) => setRunError(reason.message))
      .finally(() => setRunning(false));
  };

  if (error && !snapshot) return <div className="notice notice-error">{error}</div>;
  if (!snapshot) return <div className="loading-line"><span />载入工作台…</div>;

  const project = snapshot.project || {};
  const characters = snapshot.characters || [];
  const episodes = snapshot.episodes || [];
  const shots = snapshot.shots || [];

  const storyDone = Boolean(project.logline || project.synopsis);
  const charactersDone = characters.length > 0;
  const scriptDone = episodes.length >= project.episodeCount && shots.length > 0;
  const imageDone = shots.filter((shot) => shot.imagePath).length;
  const videoDone = shots.filter((shot) => shot.videoPath).length;
  const assetsDone = shots.length > 0 && shots.every((shot) => shot.imagePath && shot.videoPath);

  const selectedShot = sortedShots.find((shot) => shot.id === selectedShotId) || sortedShots[0] || null;
  const selectedIndex = selectedShot ? sortedShots.indexOf(selectedShot) : 0;
  const videos = sortedShots.filter((shot) => shot.videoPath);

  const stages = [
    { key: 'story', index: 1, title: '故事策划', icon: Sparkles, done: storyDone, subtitle: storyDone ? '已生成一句话故事与简介' : '尚未生成' },
    { key: 'characters', index: 2, title: '人物设计', icon: Users, done: charactersDone, subtitle: charactersDone ? `${characters.length} 位角色已生成` : '尚未生成' },
    { key: 'script', index: 3, title: '剧本与分镜', icon: FileText, done: scriptDone, subtitle: scriptDone ? `${episodes.length} 集 · ${shots.length} 镜已生成` : '尚未生成' },
    { key: 'assets', index: 4, title: '生成素材', icon: Image, done: assetsDone, subtitle: assetsDone ? '图片与视频已全部生成' : `图片 ${imageDone}/${shots.length} · 视频 ${videoDone}/${shots.length}` },
    { key: 'final', index: 5, title: '成片预览', icon: Film, done: videos.length > 0, subtitle: `${videos.length} 段成片视频` }
  ];

  const stageBody = (key) => {
    if (key === 'story') {
      return storyDone ? (
        <div className="workbench-story">
          <div className="workbench-story-block"><span className="section-kicker">LOGLINE / 一句话故事</span><p>{project.logline || '未填写一句话故事。'}</p></div>
          <div className="workbench-story-block"><span className="section-kicker">SYNOPSIS / 故事简介</span><p>{project.synopsis || '未填写故事简介。'}</p></div>
        </div>
      ) : (
        <div className="workbench-empty">
          <p>尚未生成故事策划。</p>
          <button className="button button-primary" disabled={Boolean(busyStage)} onClick={generateStory}>{busyStage === 'story' ? <><LoaderCircle size={14} className="spin" />生成中…</> : <><Sparkles size={14} />生成故事策划</>}</button>
        </div>
      );
    }

    if (key === 'characters') {
      return charactersDone ? (
        <div>
          <span className="section-kicker">CAST · {characters.length} 位角色</span>
          <div className="workbench-character-list">{characters.map((character) => <span className="character-name-tag" key={character.id}>{character.name}</span>)}</div>
        </div>
      ) : (
        <div className="workbench-empty">
          <p>尚未生成人物设计。</p>
          <button className="button button-primary" disabled={Boolean(busyStage)} onClick={generateCharacters}>{busyStage === 'characters' ? <><LoaderCircle size={14} className="spin" />生成中…</> : <><Users size={14} />生成人物设计</>}</button>
        </div>
      );
    }

    if (key === 'script') {
      return scriptDone ? (
        <div>
          <span className="section-kicker">EPISODES · {episodes.length} 集 · {shots.length} 镜</span>
          <ul className="workbench-episode-list">{episodes.map((episode) => <li key={episode.id}><span>EP {String(episode.episodeNumber).padStart(2, '0')}</span>{episode.title}</li>)}</ul>
        </div>
      ) : (
        <div className="workbench-empty">
          <p>尚未生成剧本与分镜。</p>
          <button className="button button-primary" disabled={Boolean(busyStage)} onClick={generateScript}>{busyStage === 'script' ? <><LoaderCircle size={14} className="spin" />生成中…</> : <><Clapperboard size={14} />生成剧本与分镜</>}</button>
        </div>
      );
    }

    if (key === 'assets') {
      if (!sortedShots.length) {
        return <div className="workbench-empty"><p>还没有镜头，请先在「剧本与分镜」阶段生成。</p></div>;
      }
      return (
        <div>
          <div className="workbench-toolbar">
            <label className="workbench-shot-select">
              <Clapperboard size={15} />
              <select value={selectedShot?.id || ''} onChange={(event) => setSelectedShotId(event.target.value)}>
                {sortedShots.map((shot) => (
                  <option key={shot.id} value={shot.id}>EP {String(shot.episode?.episodeNumber).padStart(2, '0')} · 镜头 {String(shot.shotNumber).padStart(2, '0')} · {shot.shotType || '镜头'}</option>
                ))}
              </select>
            </label>
            <span className="workbench-toolbar-count">{imageDone}/{shots.length} 图片 · {videoDone}/{shots.length} 视频</span>
            <button className="button button-primary" disabled={running} onClick={startRunAll}>{running ? <><LoaderCircle size={14} className="spin" />串行生成中…</> : <><Image size={14} />一键串行生成</>}</button>
          </div>
          {running ? <div className="notice workbench-runall-note workbench-runall-note-running">串行生成中，请稍候…正在逐项生成图片与视频，页面会温和刷新进度。</div> : null}
          {runError ? <div className="notice workbench-runall-note workbench-runall-note-error">{runError}</div> : null}
          {runResult ? <div className="notice workbench-runall-note workbench-runall-note-done">本次串行生成完成：共 {runResult.total} 项，成功 {runResult.succeeded}，失败 {runResult.failed}。</div> : null}
          {selectedShot ? <div className="shot-workbench"><ShotCard shot={selectedShot} index={selectedIndex} onChange={load} /></div> : null}
        </div>
      );
    }

    if (key === 'final') {
      if (!videos.length) return <div className="workbench-empty"><p>暂无成片。生成视频后，成片会显示在这里。</p></div>;
      const visibleVideos = videos.slice(0, MAX_FINAL_VIDEOS);
      return (
        <div>
          <div className="workbench-final-grid">
            {visibleVideos.map((shot) => (
              <article className="workbench-final-card panel" key={shot.id}>
                <video src={mediaUrl(shot.videoPath)} controls preload="metadata" playsInline />
                <div className="workbench-final-caption"><span>EP {String(shot.episode?.episodeNumber).padStart(2, '0')} · 镜头 {String(shot.shotNumber).padStart(2, '0')}</span><small>{shot.duration}s · {shot.shotType || '镜头'}</small></div>
              </article>
            ))}
          </div>
          {videos.length > MAX_FINAL_VIDEOS ? <p className="workbench-more-note">已显示前 {MAX_FINAL_VIDEOS} 段，另有 {videos.length - MAX_FINAL_VIDEOS} 段未显示，可在「生成素材」中按镜头逐条预览。</p> : null}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="workbench-page page-enter">
      <PageHeading eyebrow={`${project.genre} / ${project.episodeCount} EPISODES`} title={project.title} description="单页纵向工作流：故事策划 → 人物设计 → 剧本与分镜 → 生成素材 → 成片预览。" action={<button className="button button-secondary" onClick={load}><RefreshCw size={14} />刷新快照</button>} />
      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="workbench-stack">
        {stages.map((stage) => (
          <section className={`workbench-stage panel ${stage.done ? 'done' : ''}`} key={stage.key}>
            <button className="workbench-stage-head" onClick={() => toggle(stage.key)} aria-expanded={Boolean(open[stage.key])}>
              <span className="workbench-stage-index">{stage.done ? <Check size={13} /> : String(stage.index).padStart(2, '0')}</span>
              <span className="workbench-stage-title">
                <span className="section-kicker">STAGE {String(stage.index).padStart(2, '0')}</span>
                <strong>{stage.title}</strong>
                <small>{stage.subtitle}</small>
              </span>
              <ChevronDown size={16} className={`workbench-chevron ${open[stage.key] ? 'open' : ''}`} />
            </button>
            {open[stage.key] ? <div className="workbench-stage-body">{stageBody(stage.key)}</div> : null}
          </section>
        ))}
      </div>
    </div>
  );
}
