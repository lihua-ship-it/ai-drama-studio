import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, RefreshCw } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { api } from '../services/api.js';
import { parseJson } from '../utils/format.js';

export default function ScriptPage() {
  const { projectId } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { if (projectId) { try { setSnapshot(await api.projects.get(projectId)); setError(''); } catch (reason) { setError(reason.message); } } };
  useEffect(() => { load(); }, [projectId]);

  const regenerate = async (episodeNumber) => {
    setBusy(true); setError('');
    try {
      await api.projects.script(projectId, episodeNumber ? { episodeNumber } : {});
      await api.projects.storyboard(projectId, episodeNumber ? { episodeNumber } : {});
      await api.projects.imagePrompts(projectId, episodeNumber ? { episodeNumber } : {});
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  if (!snapshot) return <div className={error ? 'notice notice-error' : 'loading-line'}>{error || '读取剧本…'}</div>;
  const { project, characters, episodes } = snapshot;
  return (
    <div className="script-page page-enter">
      <PageHeading eyebrow="SCRIPT ROOM / DRAFT" title="剧本" description={`${project.title} · ${episodes.length} 集完整结构`} action={<button className="button button-secondary" disabled={busy} onClick={() => regenerate()}><RefreshCw size={14} className={busy ? 'spin' : ''} />重新生成整部剧本</button>} />
      {error ? <div className="notice notice-error">{error}</div> : null}
      <section className="script-summary panel"><div className="section-kicker">LOGLINE / SYNOPSIS</div><h2>{project.logline || '故事策划尚未生成'}</h2><p>{project.synopsis}</p><div className="script-character-strip"><span className="section-kicker">CAST</span>{characters.map((character) => <span key={character.id}>{character.name}<small>{character.identity}</small></span>)}</div></section>
      <div className="episode-stack">
        {episodes.map((episode) => (
          <article className="episode-script panel" key={episode.id}>
            <header className="episode-script-head"><div className="episode-index">EP <strong>{String(episode.episodeNumber).padStart(2, '0')}</strong></div><div><span className="section-kicker">EPISODE {String(episode.episodeNumber).padStart(2, '0')}</span><h2>{episode.title}</h2></div><button className="icon-button" disabled={busy} title="重新生成本集剧本与分镜" onClick={() => regenerate(episode.episodeNumber)}><RefreshCw size={15} className={busy ? 'spin' : ''} /></button></header>
            <p className="episode-summary">{episode.summary}</p>
            <div className="script-scenes">
              {episode.scenes.map((scene) => (
                <section className="script-scene" key={scene.id}>
                  <div className="scene-title-row"><span className="scene-number">{String(scene.sceneNumber).padStart(2, '0')}</span><div><h3>{scene.location}</h3><span>{scene.time} {scene.atmosphere ? `· ${scene.atmosphere}` : ''}</span></div><BookOpen size={15} /></div>
                  <p className="scene-description">{scene.description}</p>
                  <div className="dialogue-lines">{parseJson(scene.dialogueJson).map((line, index) => <div className="script-dialogue" key={`${scene.id}-${index}`}><strong>{line.characterName}</strong><span>{line.text}</span>{line.emotion && line.emotion !== 'neutral' ? <small>{line.emotion}</small> : null}</div>)}</div>
                </section>
              ))}
            </div>
            <div className="ending-hook"><span>ENDING HOOK</span><p>{episode.endingHook}</p></div>
          </article>
        ))}
      </div>
    </div>
  );
}