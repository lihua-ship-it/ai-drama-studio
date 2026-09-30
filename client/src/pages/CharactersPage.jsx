import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Aperture, AudioLines, RefreshCw, Save, UserRound } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { api } from '../services/api.js';
import { mediaUrl } from '../utils/format.js';

export default function CharactersPage() {
  const { projectId } = useOutletContext();
  const [characters, setCharacters] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!projectId) return;
    try { const snapshot = await api.projects.get(projectId); setCharacters(snapshot.characters); setError(''); }
    catch (reason) { setError(reason.message); }
  };
  useEffect(() => { load(); }, [projectId]);

  const updateField = (characterId, value) => setCharacters((items) => items.map((item) => item.id === characterId ? { ...item, voiceId: value } : item));
  const saveVoice = async (character) => {
    setBusyId(character.id);
    try { await api.projects.updateCharacter(character.id, { voiceId: character.voiceId }); }
    catch (reason) { setError(reason.message); }
    finally { setBusyId(''); }
  };
  const generateImage = async (character) => {
    setBusyId(character.id); setError('');
    try { await api.media.characterImage(character.id); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusyId(''); }
  };

  return (
    <div className="characters-page page-enter">
      <PageHeading eyebrow="CAST / CHARACTER BIBLE" title="角色设定" description="固定外貌和服装会被追加到每个相关镜头的图片 Prompt。" action={<span className="count-chip"><UserRound size={14} />{characters.length} 位人物</span>} />
      {error ? <div className="notice notice-error">{error}</div> : null}
      {!characters.length && !error ? <div className="empty-panel panel"><Aperture size={24} /><strong>人物尚未生成</strong><span>先在项目详情完成人物设定阶段。</span></div> : null}
      <div className="character-grid">
        {characters.map((character, index) => (
          <article className="character-card panel" key={character.id}>
            <div className="character-portrait">
              {character.referenceImagePath ? <img src={mediaUrl(character.referenceImagePath)} alt={`${character.name}角色参考图`} /> : <div className={`portrait-empty portrait-empty-${index % 3}`}><UserRound size={34} strokeWidth={1.2} /><span>REFERENCE IMAGE</span></div>}
              <div className="portrait-label">CHARACTER {String(index + 1).padStart(2, '0')}</div>
            </div>
            <div className="character-card-content">
              <div className="character-name-row"><div><h2>{character.name}</h2><span>{character.age} · {character.gender} · {character.identity}</span></div><span className={`status-pill status-${character.imageStatus}`}>{character.imageStatus}</span></div>
              <p className="character-personality">{character.personality}</p>
              <div className="character-lock-grid"><div><small>FACE / 面部</small><p>{character.faceDescription}</p></div><div><small>HAIR / 发型</small><p>{character.hairDescription}</p></div><div><small>BODY / 体态</small><p>{character.bodyDescription}</p></div><div><small>COSTUME / 服装</small><p>{character.clothingDescription}</p></div></div>
              <label className="voice-input"><span><AudioLines size={14} />角色声音 ID</span><input value={character.voiceId} onChange={(event) => updateField(character.id, event.target.value)} placeholder="填入 TTS speaker / voice_type" /></label>
              <div className="character-card-actions"><button className="button button-secondary" disabled={busyId === character.id} onClick={() => saveVoice(character)}><Save size={14} />保存声音</button><button className="button button-primary" disabled={busyId === character.id} onClick={() => generateImage(character)}>{busyId === character.id ? <span className="button-spinner" /> : character.referenceImagePath ? <RefreshCw size={14} /> : <Aperture size={15} />}{character.referenceImagePath ? '重新生成参考图' : '生成角色参考图'}</button></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}