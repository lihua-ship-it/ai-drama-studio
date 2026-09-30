import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Clapperboard, RefreshCw, SlidersHorizontal } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import ShotCard from '../components/ShotCard.jsx';
import { api } from '../services/api.js';

export default function StoryboardPage() {
  const { projectId } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [episodeId, setEpisodeId] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!projectId) return;
    try { setSnapshot(await api.projects.get(projectId)); setError(''); }
    catch (reason) { setError(reason.message); }
  };
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    if (!snapshot?.shots?.some((shot) => shot.videoTaskId && ['queued', 'running'].includes(shot.videoStatus))) return undefined;
    const timer = setInterval(async () => {
      const active = snapshot.shots.filter((shot) => shot.videoTaskId && ['queued', 'running'].includes(shot.videoStatus));
      for (const shot of active.slice(0, 1)) {
        try { await api.media.videoStatus(shot.id); } catch (reason) { setError(reason.message); }
      }
      await load();
    }, 10000);
    return () => clearInterval(timer);
  }, [snapshot, projectId]);

  const episodes = snapshot?.episodes || [];
  const selectedEpisode = episodes.find((episode) => episode.id === episodeId);
  const visibleShots = useMemo(() => {
    const shots = snapshot?.shots || [];
    return shots.filter((shot) => episodeId === 'all' || shot.episodeId === episodeId)
      .sort((left, right) => left.episode.episodeNumber - right.episode.episodeNumber || left.scene.sceneNumber - right.scene.sceneNumber || left.shotNumber - right.shotNumber);
  }, [snapshot, episodeId]);

  const regeneratePrompts = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api.projects.imagePrompts(projectId, selectedEpisode ? { episodeNumber: selectedEpisode.episodeNumber } : {});
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  const regenerateStoryboard = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api.projects.storyboard(projectId, selectedEpisode ? { episodeNumber: selectedEpisode.episodeNumber } : {});
      await api.projects.imagePrompts(projectId, selectedEpisode ? { episodeNumber: selectedEpisode.episodeNumber } : {});
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="storyboard-page page-enter">
      <PageHeading eyebrow="SHOT DESIGN / CONTINUITY" title="分镜工作台" description={`${snapshot?.project.title || '读取项目…'} · 人物外貌、服装和跨镜头连续状态会进入生图 Prompt。`} action={<button className="button button-secondary" disabled={busy} onClick={regenerateStoryboard}><RefreshCw size={14} className={busy ? 'spin' : ''} />重新生成分镜</button>} />
      {error ? <div className="notice notice-error">{error}</div> : null}
      <div className="storyboard-toolbar"><label className="episode-filter"><SlidersHorizontal size={15} /><select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)}><option value="all">全部分集 · {snapshot?.shots.length || 0} 镜</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>EP {String(episode.episodeNumber).padStart(2, '0')} · {episode.title}</option>)}</select></label><span className="toolbar-count">{visibleShots.length} 个镜头</span><button className="text-action" disabled={busy || !visibleShots.length} onClick={regeneratePrompts}><RefreshCw size={13} />重写当前分镜 Prompt</button></div>
      {!visibleShots.length && !error ? <div className="empty-panel panel"><Clapperboard size={25} /><strong>还没有镜头</strong><span>先生成分集剧本，再创建分镜。</span></div> : null}
      <div className="shot-workbench">{visibleShots.map((shot, index) => <ShotCard key={shot.id} shot={shot} index={index} onChange={load} />)}</div>
    </div>
  );
}