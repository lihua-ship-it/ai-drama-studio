import { useState } from 'react';
import { AudioLines, ImagePlus, LoaderCircle, RefreshCw, Video } from 'lucide-react';
import { api } from '../services/api.js';
import { mediaUrl, parseJson } from '../utils/format.js';

export default function ShotCard({ shot, index, onChange }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const dialogue = parseJson(shot.dialogueJson);
  const names = parseJson(shot.characterNamesJson);
  const audioAssets = parseJson(shot.audioAssetsJson);

  const run = async (key, action) => {
    if (busy) return;
    setBusy(key); setError('');
    try { await action(); await onChange(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(''); }
  };

  const makeVideo = () => run('video', () => api.media.shotVideo(shot.id));
  const makeImage = () => run('image', () => api.media.shotImage(shot.id));
  const speak = async () => {
    if (busy) return;
    setBusy('tts'); setError('');
    try {
      for (let dialogueIndex = 0; dialogueIndex < dialogue.length; dialogueIndex += 1) {
        await api.media.speech(shot.id, dialogueIndex);
      }
      await onChange();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(''); }
  };

  return (
    <article className="shot-card panel" id={`shot-${shot.id}`}>
      <div className="shot-card-top"><div className="shot-number-block"><span>SHOT</span><strong>{String(index + 1).padStart(2, '0')}</strong></div><div className="shot-heading-copy"><div className="shot-context">EP {String(shot.episode.episodeNumber).padStart(2, '0')} · SC {String(shot.scene.sceneNumber).padStart(2, '0')}</div><h3>{shot.shotType || '镜头'} <span>{shot.duration}s</span></h3></div><span className={`status-pill status-${shot.videoStatus}`}>{shot.videoStatus}</span></div>

      <div className="shot-media-grid">
        <div className="shot-media-unit"><div className="media-label"><span>KEYFRAME / 16:9</span><span>{shot.imageStatus}</span></div>{shot.imagePath ? <img className="shot-preview" src={mediaUrl(shot.imagePath)} alt={`镜头 ${index + 1} 关键帧`} /> : <div className="shot-preview shot-preview-empty"><ImagePlus size={23} /><span>等待关键帧生成</span></div>}</div>
        <div className="shot-media-unit"><div className="media-label"><span>MOTION / 16:9</span><span>{shot.videoProgress ? `${shot.videoProgress}%` : shot.videoStatus}</span></div>{shot.videoPath ? <video className="shot-preview" src={mediaUrl(shot.videoPath)} controls preload="metadata" /> : <div className="shot-preview shot-preview-empty video-placeholder"><Video size={23} /><span>{shot.videoStatus === 'running' || shot.videoStatus === 'queued' ? `Seedance ${shot.videoStatus} · ${shot.videoTaskId.slice(0, 14)}` : '等待 Seedance 生成'}</span></div>}</div>
      </div>

      <div className="shot-detail-grid"><div><span className="detail-kicker">CAMERA</span><p>{shot.cameraAngle || '机位待定'} · {shot.cameraMovement || '运镜待定'}</p></div><div><span className="detail-kicker">CAST</span><p>{names.join('、') || '无出场人物'}</p></div><div className="shot-action-detail"><span className="detail-kicker">ACTION / 动作</span><p>{shot.action}</p></div></div>

      <div className="shot-dialogue-block"><span className="detail-kicker">DIALOGUE / 对白</span>{dialogue.length ? dialogue.map((line, lineIndex) => <div className="shot-dialogue-line" key={`${shot.id}-line-${lineIndex}`}><strong>{line.characterName}</strong><span>{line.text}</span>{line.emotion && line.emotion !== 'neutral' ? <small>{line.emotion}</small> : null}{audioAssets[lineIndex]?.filePath ? <audio src={mediaUrl(audioAssets[lineIndex].filePath)} controls preload="none" /> : null}</div>) : <p>此镜头无对白</p>}</div>

      <div className="prompt-columns"><div className="prompt-preview"><span>IMAGE PROMPT</span><p>{shot.imagePrompt}</p></div><div className="prompt-preview"><span>VIDEO PROMPT</span><p>{shot.videoPrompt}</p></div></div>
      <div className="shot-footer"><div className="shot-footer-status"><span><i className={`mini-led led-${shot.imageStatus}`} />图片 {shot.imageStatus}</span><span><i className={`mini-led led-${shot.audioStatus}`} />配音 {shot.audioStatus}</span></div><div className="shot-actions"><button className="button button-quiet" disabled={Boolean(busy) || !dialogue.length} onClick={speak}>{busy === 'tts' ? <LoaderCircle size={14} className="spin" /> : <AudioLines size={14} />}生成配音</button><button className="button button-secondary" disabled={Boolean(busy)} onClick={makeImage}>{busy === 'image' ? <LoaderCircle size={14} className="spin" /> : shot.imagePath ? <RefreshCw size={14} /> : <ImagePlus size={14} />}{shot.imagePath ? '重新生成图片' : '生成图片'}</button><button className="button button-primary" disabled={Boolean(busy) || ['queued', 'running'].includes(shot.videoStatus)} onClick={makeVideo}>{busy === 'video' ? <LoaderCircle size={14} className="spin" /> : <Video size={14} />}{shot.videoPath ? '重新生成视频' : '生成视频'}</button></div></div>
      {error ? <div className="inline-error">{error}</div> : null}
    </article>
  );
}