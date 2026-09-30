import { Router } from 'express';
import * as controller from '../controllers/projectController.js';
import * as media from '../services/mediaService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:projectId', controller.get);
router.post('/:projectId/story', controller.generateStory);
router.post('/:projectId/characters', controller.generateCharacters);
router.post('/:projectId/script', controller.generateScript);
router.post('/:projectId/storyboard', controller.generateStoryboard);
router.post('/:projectId/image-prompts', controller.generateImagePrompts);
router.patch('/characters/:characterId', controller.updateCharacter);
router.post('/:projectId/assets/queue', controller.startQueue);
router.post('/:projectId/assets/run-all', asyncHandler(async (request, response) => {
  response.json(await media.runQueueSerially(request.params.projectId, request.body.types));
}));
router.post('/tasks/:taskId/run', controller.runTask);
router.post('/tasks/:taskId/retry', controller.retryTask);

export default router;