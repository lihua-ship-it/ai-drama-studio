import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clapperboard, Sparkles } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';
import { api } from '../services/api.js';

const genres = ['悬疑', '都市', '爱情', '喜剧', '家庭', '古装', '奇幻', '职场', '科幻', '现实'];

export default function CreatePage() {
  const navigate = useNavigate();
  const { refreshProject } = useOutletContext();
  const [form, setForm] = useState({ theme: '', genre: '悬疑', episodeCount: 6, durationPerEpisode: 3, characterRequirements: '', visualStyle: '电影级写实，16:9，真实光影', storyRequirements: '' });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setStage('保存项目');
      const project = await api.projects.create({ ...form, episodeCount: Number(form.episodeCount), durationPerEpisode: Number(form.durationPerEpisode), requestKey: crypto.randomUUID() });
      setStage('DeepSeek · 故事策划');
      await api.projects.story(project.id);
      navigate(`/project/${project.id}`);
    } catch (reason) {
      setError(reason.message);
      if (reason.code === 'HTTP_ERROR') {
        setStage('检查后端配置后可在项目页续跑');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="create-page page-enter">
      <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={15} />返回项目库</button>
      <PageHeading eyebrow="NEW PRODUCTION / 01" title="先从一个念头开始。" description="创作设定会作为剧本与角色生成的真实上下文。" />
      <div className="creation-layout">
        <form className="creation-form panel" onSubmit={submit}>
          <div className="panel-heading"><div><span className="panel-index">01</span><div><h2>故事设定</h2><p>描述你想拍的故事</p></div></div><Clapperboard size={18} /></div>
          <label className="field"><span>短剧主题 <em>必填</em></span><textarea name="theme" value={form.theme} onChange={update} minLength={3} maxLength={1200} required placeholder="一个失忆的急诊医生，在旧病历中发现自己曾救过未来的凶手……" rows={5} /><small>{form.theme.length} / 1200</small></label>
          <div className="field-grid">
            <label className="field"><span>类型</span><select name="genre" value={form.genre} onChange={update}>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select></label>
            <label className="field"><span>集数 <small>1–12</small></span><input name="episodeCount" type="number" min="1" max="12" value={form.episodeCount} onChange={update} required /></label>
            <label className="field"><span>单集时长 <small>分钟</small></span><input name="durationPerEpisode" type="number" min="1" max="30" value={form.durationPerEpisode} onChange={update} required /></label>
          </div>
          <label className="field"><span>人物要求 <small>选填</small></span><textarea name="characterRequirements" value={form.characterRequirements} onChange={update} maxLength={2000} placeholder="人物身份、关系、性格或隐藏秘密" rows={3} /></label>
          <label className="field"><span>视觉风格</span><input name="visualStyle" value={form.visualStyle} onChange={update} maxLength={300} placeholder="电影写实、胶片颗粒、冷暖对照" /></label>
          <label className="field"><span>其他要求 <small>选填</small></span><textarea name="storyRequirements" value={form.storyRequirements} onChange={update} maxLength={2000} placeholder="节奏、受众、反转、结局或必须出现的情节" rows={3} /></label>
          {error ? <div className="notice notice-error">{error}<span>{stage}</span></div> : null}
          <div className="form-footer"><span><i className="status-led" />真实 DeepSeek 生成 · 本地保存</span><button className="button button-primary" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" />{stage || '正在创作'}</> : <><Sparkles size={15} />开始创作<ArrowRight size={15} /></>}</button></div>
        </form>
        <aside className="creation-aside"><div className="aside-note"><span className="aside-number">A</span><h3>每个决定，都成为制作依据。</h3><p>人物外貌、叙事节奏与视觉风格会延续到分镜 Prompt 与后续素材生成。</p></div><div className="aside-flow"><div><span>01</span>故事策划<i>DeepSeek</i></div><div><span>02</span>人物与剧本<i>结构化 JSON</i></div><div><span>03</span>分镜工作台<i>连续性锁定</i></div><div><span>04</span>真实素材生成<i>按需排队</i></div></div></aside>
      </div>
    </div>
  );
}