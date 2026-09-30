import { generateStory } from '../providers/deepseek.js';
import { generateShotImage } from '../providers/seedream.js';
import { createVideoTask, getVideoTask } from '../providers/seedance.js';
import { generateSpeech } from '../providers/tts.js';
import { env } from '../config/env.js';
import { requireConfig } from '../config/env.js';

const provider = process.argv[2];
const projectId = 'provider-connection-test';

async function main() {
  if (provider === 'deepseek') {
    const result = await generateStory({
      theme: '一次误会让两位旧友在车站重逢并解开一封未寄出的信',
      genre: '现实短剧', episodeCount: 1, durationPerEpisode: 1,
      visualStyle: '自然写实', characterRequirements: '两位成年旧友', storyRequirements: '单集短篇'
    });
    console.log('DeepSeek real request succeeded:', JSON.stringify({ title: result.title, hasSynopsis: Boolean(result.synopsis) }));
    return;
  }

  if (provider === 'seedream') {
    requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
    requireConfig('SEEDREAM_MODEL', env.seedreamModel);
    const result = await generateShotImage({
      projectId,
      prompt: '16:9 wide cinematic still, a quiet empty train platform at dusk, realistic natural lighting, no text or watermark',
      references: []
    });
    console.log('Seedream real request succeeded:', JSON.stringify({ filePath: result.filePath, size: result.size }));
    return;
  }

  if (provider === 'seedance-create') {
    requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
    requireConfig('SEEDANCE_MODEL', env.seedanceModel);
    requireConfig('SEEDANCE_TEST_IMAGE_URL', process.env.SEEDANCE_TEST_IMAGE_URL);
    const result = await createVideoTask({
      imageUrl: process.env.SEEDANCE_TEST_IMAGE_URL,
      prompt: 'A short cinematic slow camera push-in; preserve the reference image composition.',
      duration: 3,
      aspectRatio: '16:9'
    });
    console.log('Seedance real task created:', JSON.stringify({ taskId: result.taskId, status: result.status }));
    console.log('Use the exact returned taskId with the seedance-status test.');
    return;
  }

  if (provider === 'seedance-status') {
    requireConfig('SEEDANCE_TEST_TASK_ID', process.env.SEEDANCE_TEST_TASK_ID);
    const result = await getVideoTask(process.env.SEEDANCE_TEST_TASK_ID);
    console.log('Seedance real task status:', JSON.stringify({ status: result.status, progress: result.progress, hasVideo: Boolean(result.videoUrl), hasLastFrame: Boolean(result.lastFrameUrl) }));
    return;
  }

  if (provider === 'tts') {
    requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
    requireConfig('TTS_RESOURCE_ID', env.ttsResourceId);
    requireConfig('TTS_TEST_VOICE_ID', process.env.TTS_TEST_VOICE_ID);
    const result = await generateSpeech({
      projectId,
      character: { id: 'provider-test', voiceId: process.env.TTS_TEST_VOICE_ID },
      text: '这是语音接口连通性测试。',
      emotion: 'neutral',
      speed: 1
    });
    console.log('TTS real request succeeded:', JSON.stringify({ filePath: result.filePath, duration: result.duration, bytes: result.size }));
    return;
  }

  throw new Error('Choose exactly one provider: deepseek | seedream | seedance-create | seedance-status | tts');
}

main().catch((error) => {
  console.error('Provider test failed:', error.code || error.message, error.details || '');
  process.exitCode = 1;
});