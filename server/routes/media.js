import { Router } from 'express';
import * as controller from '../controllers/mediaController.js';

const router = Router();
router.post('/characters/:characterId/image', controller.generateCharacterImage);
router.post('/scenes/:sceneId/image', controller.generateSceneImage);
router.post('/shots/:shotId/image', controller.generateShotImage);
router.post('/shots/:shotId/video', controller.createVideo);
router.get('/shots/:shotId/video/status', controller.videoStatus);
router.post('/shots/:shotId/tts', controller.speech);

export default router;