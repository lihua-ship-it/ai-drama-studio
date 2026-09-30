import * as projects from '../services/projectService.js';
import * as media from '../services/mediaService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  response.json(await projects.listProjects());
});

export const create = asyncHandler(async (request, response) => {
  response.status(201).json(await projects.createProject(request.body));
});

export const get = asyncHandler(async (request, response) => {
  response.json(await projects.getProjectSnapshot(request.params.projectId));
});

export const generateStory = asyncHandler(async (request, response) => {
  response.json(await projects.generateStage(request.params.projectId, 'story'));
});

export const generateCharacters = asyncHandler(async (request, response) => {
  const result = await projects.generateStage(request.params.projectId, 'characters');
  response.json(result);
});

export const generateScript = asyncHandler(async (request, response) => {
  const result = await projects.generateStage(request.params.projectId, request.body.episodeNumber ? 'episodeScript' : 'script', request.body);
  if (request.body.episodeNumber) await projects.generateStage(request.params.projectId, 'storyboard', request.body);
  response.json(result);
});

export const generateStoryboard = asyncHandler(async (request, response) => {
  response.json(await projects.generateStage(request.params.projectId, 'storyboard', request.body));
});

export const generateImagePrompts = asyncHandler(async (request, response) => {
  response.json(await projects.generateStage(request.params.projectId, 'imagePrompts', request.body));
});

export const updateCharacter = asyncHandler(async (request, response) => {
  response.json(await projects.updateCharacter(request.params.characterId, request.body));
});

export const startQueue = asyncHandler(async (request, response) => {
  response.status(202).json(await media.startAssetQueue(request.params.projectId, request.body.types));
});

export const runTask = asyncHandler(async (request, response) => {
  response.json(await media.runAssetTask(request.params.taskId));
});

export const retryTask = asyncHandler(async (request, response) => {
  response.json(await media.retryAssetTask(request.params.taskId));
});