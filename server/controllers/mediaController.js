import * as media from '../services/mediaService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateCharacterImage = asyncHandler(async (request, response) => {
  response.json(await media.generateCharacterPhoto(request.params.characterId));
});

export const generateSceneImage = asyncHandler(async (request, response) => {
  response.json(await media.generateSceneImage(request.params.sceneId));
});

export const generateShotImage = asyncHandler(async (request, response) => {
  response.json(await media.generateShotImage(request.params.shotId));
});

export const createVideo = asyncHandler(async (request, response) => {
  response.status(202).json(await media.createShotVideo(request.params.shotId));
});

export const videoStatus = asyncHandler(async (request, response) => {
  response.json(await media.getShotVideoStatus(request.params.shotId));
});

export const speech = asyncHandler(async (request, response) => {
  response.json(await media.generateShotSpeech(request.params.shotId, Number(request.body.dialogueIndex)));
});