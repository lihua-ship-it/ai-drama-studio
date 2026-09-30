import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AudioLines, Image, LoaderCircle, RefreshCw, Video } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { api } from '../services/api.js';
import { percent } from '../utils/format.js';

async function runBounded(items, concurrency, action) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await action(items[index]);
    }
  });
  await Promise.all(workers);
}

export default function AssetsPage() {
  const { projectId } = useOutletContext();
  const [snapshot, setSnapshot] = useState(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueLabel, setQueueLabel] = useState('');
  const [error, setError] = useState('');
  const load = async () => { if (projectId) { try { setSnapshot(await api.projects.get(projectId)); setError(''); } catch (reason) { setError(reason.message); } } };
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    const pending = snapshot?.shots?.some((shot) => shot.videoTaskId && ['queued', 'running'].includes(shot.videoStatus));
    if (!pending) return undefined;
    const timer = setInterval(async () => {
      const activeShots = snapshot.shots.filter((shot) => shot.videoTaskId && ['queued', 'running'].includes(shot.videoStatus)).slice(0, 1);
      for (const shot of activeShots) {
        try { await api.media.videoStatus(shot.id); } catch (reason) { setError(reason.message); }
      }
      await load();
    }, 10000);
    return () => clearInterval(timer);
  }, [snapshot, projectId]);

  const shots = snapshot?.shots || [];
  const characters = snapshot?.characters || [];
  const imageDone = characters.filter((character) => character.referenceImagePath).length + shots.filter((shot) => shot.imagePath).length;
  const imageTotal = characters.length + shots.length;
  const videosDone = shots.filter((shot) => shot.videoPath).length;
  const audioDone = shots.reduce((sum, shot) => sum + JSON.parse(shot.audioAssetsJson || '[]').length, 0);
  const audioTotal = shots.reduce((sum, shot) => sum + JSON.parse(shot.dialogueJson || '[]').length, 0);

  const startQueue = async () => {
    if (queueBusy) return;
    setQueueBusy(true); setError('');
    try {
      const queue = await api.projects.queue(projectId, ['images', 'videos', 'speech']);
      const imageTasks = queue.tasks.filter((task) => ['character_image', 'scene_image', 'shot_image'].includes(task.type));
      const videoTasks = queue.tasks.filter((task) => task.type === 'video');
      const speechTasks = queue.tasks.filter((task) => task.type === 'tts');
      const groups = [
        { name: '图片生成', items: imageTasks, concurrency: 2 },
        { name: '视频任务创建', items: videoTasks, concurrency: 1 },
        { name: '对白配音', items: speechTasks, concurrency: 1 }
      ];
      for (const group of groups) {
        if (!group.items.length) continue;
        setQueueLabel(`${group.name} · ${group.items.length} 项`);
        await runBounded(group.items, group.concurrency, async (task) => {
          try { await api.projects.runTask(task.id); }
          catch (reason) { setError(reason.message); }
          await load();
        });
      }
      await load();
    } catch (reason) { setError(reason.message); }
    finally { setQueueBusy(false); setQueueLabel(''); }
  };

  const retry = async (taskId) => {
    try { await api.projects.retryTask(taskId); await api.projects.runTask(taskId); await load(); }
    catch (reason) { setError(reason.message); }
  };

  return (
    <div className="assets-page page-enter">
      <PageHeading eyebrow="GENERATION QUEUE / LOCAL ASSETS" title="素材生成" description="任务进度写入 SQLite；生成文件保存在 server/uploads。Seedance 任务由真实状态接口轮询。" action={<button className="button button-primary" disabled={queueBusy || !snapshot?.shots.length} onClick={startQueue}>{queueBusy ? <><LoaderCircle size={15} className="spin" />{queueLabel || '队列运行中'}</> : <><Image size={15} />继续生成未完成素材</>}</button>} />
      {error ? <div className="notice notice-error">{error}</div> : null}
      <div className="asset-metric-grid">
        <Metric title="图片生成" value={`${imageDone} / ${imageTotal}`} percentValue={percent(imageDone, imageTotal)} kind="image" icon={<Image size={17} />} />
        <Metric title="视频生成" value={`${videosDone} / ${shots.length}`} percentValue={percent(videosDone, shots.length)} kind="video" icon={<Video size={17} />} />
        <Metric title="TTS 配音" value={`${audioDone} / ${audioTotal}`} percentValue={percent(audioDone, audioTotal)} kind="audio" icon={<AudioLines size={17} />} />
      </div>
      <section className="panel queue-panel"><div className="panel-heading"><div><span className="section-kicker">AI TASKS</span><h2>最近任务 <span>{snapshot?.aiTasks.length || 0}</span></h2></div><button className="icon-button" onClick={load} title="刷新"><RefreshCw size={15} /></button></div>
        {!snapshot?.aiTasks.length ? <div className="queue-empty">还没有素材任务。选择“继续生成”后会按图片 2、Seedance 1、TTS 1 的并发上限执行。</div> : <div className="task-table"><div className="task-table-head"><span>类型</span><span>镜头</span><span>状态</span><span>进度</span><span>操作</span></div>{snapshot.aiTasks.map((task) => { const shot = shots.find((item) => item.id === task.shotId); return <div className="task-row" key={task.id}><span className="task-type"><i className={`task-type-dot task-${task.type}`} />{task.type}</span><span>{shot ? `EP${shot.episode.episodeNumber} · ${shot.shotNumber}` : task.characterId ? '角色参考图' : '—'}</span><span className={`task-status task-status-${task.status}`}>{task.status}</span><span className="task-progress"><span><i style={{ width: `${task.progress}%` }} /></span>{task.progress}%</span><span>{['failed', 'expired'].includes(task.status) ? <button className="text-action" onClick={() => retry(task.id)}><RefreshCw size={13} />重试</button> : '—'}</span></div>; })}</div>}
      </section>
    </div>
  );
}

function Metric({ title, value, percentValue, kind, icon }) {
  return <section className={`asset-metric panel metric-${kind}`}><div className="metric-top"><span>{icon}{title}</span><span>{percentValue}%</span></div><strong>{value}</strong><div className="metric-track"><i style={{ width: `${percentValue}%` }} /></div><small>同步自本地项目数据</small></section>;
}