import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Film, Play } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { mediaUrl } from '../utils/format.js';

export default function FinalPage() {
  const { projectId } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [episodeId, setEpisodeId] = useState('all');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}`).then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error?.message || '读取项目失败');
      return response.json();
    }).then((data) => { if (active) setSnapshot(data); }).catch((reason) => setError(reason.message));
    return () => { active = false; };
  }, [projectId]);

  if (!snapshot) return <div className={error ? 'notice notice-error' : 'loading-line'}>{error || '读取真实视频素材…'}</div>;
  const episodes = snapshot.episodes;
  const filtered = episodes.filter((episode) => episodeId === 'all' || episode.id === episodeId);
  const videoCount = snapshot.shots.filter((shot) => shot.videoPath).length;
  return (
    <div className="final-page page-enter">
      <PageHeading eyebrow="FINAL CUT / GENERATED FOOTAGE" title="成片素材" description={`${snapshot.project.title} · 按集查看 Seedance 实际生成的视频片段。`} action={<span className="count-chip"><Film size={14} />{videoCount} 段视频</span>} />
      <div className="final-filter"><span className="section-kicker">EPISODE</span><button className={episodeId === 'all' ? 'filter-chip selected' : 'filter-chip'} onClick={() => setEpisodeId('all')}>全部</button>{episodes.map((episode) => <button key={episode.id} className={episodeId === episode.id ? 'filter-chip selected' : 'filter-chip'} onClick={() => setEpisodeId(episode.id)}>EP {String(episode.episodeNumber).padStart(2, '0')}</button>)}</div>
      {filtered.map((episode) => {
        const videos = episode.shots.filter((shot) => shot.videoPath);
        return <section className="final-episode" key={episode.id}><div className="final-episode-heading"><div><span className="section-kicker">EPISODE {String(episode.episodeNumber).padStart(2, '0')}</span><h2>{episode.title}</h2></div><span>{videos.length} / {episode.shots.length} 镜头</span></div>{videos.length ? <div className="final-video-grid">{videos.map((shot) => <article className="final-video-card panel" key={shot.id}><video src={mediaUrl(shot.videoPath)} controls preload="metadata" playsInline /><div className="final-video-caption"><span><Play size={12} />镜头 {String(shot.shotNumber).padStart(2, '0')}</span><small>{shot.duration}s · {shot.shotType}</small></div></article>)}</div> : <div className="final-empty"><Film size={18} />本集还没有生成视频素材。成片页只展示真实视频，不会用图片或模拟内容代替。</div>}</section>;
      })}
    </div>
  );
}