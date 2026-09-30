-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "genre" TEXT NOT NULL DEFAULT '都市',
    "style" TEXT NOT NULL DEFAULT '电影级写实，16:9',
    "episodeCount" INTEGER NOT NULL DEFAULT 6,
    "durationPerEpisode" INTEGER NOT NULL DEFAULT 3,
    "characterRequirements" TEXT NOT NULL DEFAULT '',
    "storyRequirements" TEXT NOT NULL DEFAULT '',
    "logline" TEXT NOT NULL DEFAULT '',
    "synopsis" TEXT NOT NULL DEFAULT '',
    "storyJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'created',
    "progressJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "identity" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "appearance" TEXT NOT NULL DEFAULT '',
    "faceDescription" TEXT NOT NULL DEFAULT '',
    "hairDescription" TEXT NOT NULL DEFAULT '',
    "bodyDescription" TEXT NOT NULL DEFAULT '',
    "clothingDescription" TEXT NOT NULL DEFAULT '',
    "voiceId" TEXT NOT NULL DEFAULT '',
    "voiceProfile" TEXT NOT NULL DEFAULT '',
    "relationships" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL DEFAULT '',
    "referenceImagePath" TEXT NOT NULL DEFAULT '',
    "imageStatus" TEXT NOT NULL DEFAULT 'idle',
    "imageError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "endingHook" TEXT NOT NULL DEFAULT '',
    "renderTaskId" TEXT NOT NULL DEFAULT '',
    "renderStatus" TEXT NOT NULL DEFAULT 'idle',
    "renderProgress" INTEGER NOT NULL DEFAULT 0,
    "renderPath" TEXT NOT NULL DEFAULT '',
    "renderError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "atmosphere" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "dialogueJson" TEXT NOT NULL DEFAULT '[]',
    "imagePath" TEXT NOT NULL DEFAULT '',
    "imageStatus" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotNumber" INTEGER NOT NULL,
    "shotType" TEXT NOT NULL DEFAULT '',
    "cameraAngle" TEXT NOT NULL DEFAULT '',
    "cameraMovement" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL DEFAULT 5,
    "characterIdsJson" TEXT NOT NULL DEFAULT '[]',
    "characterNamesJson" TEXT NOT NULL DEFAULT '[]',
    "action" TEXT NOT NULL DEFAULT '',
    "dialogueJson" TEXT NOT NULL DEFAULT '[]',
    "emotion" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL DEFAULT '',
    "negativePrompt" TEXT NOT NULL DEFAULT '',
    "videoPrompt" TEXT NOT NULL DEFAULT '',
    "continuityJson" TEXT NOT NULL DEFAULT '{}',
    "imagePath" TEXT NOT NULL DEFAULT '',
    "videoPath" TEXT NOT NULL DEFAULT '',
    "lastFramePath" TEXT NOT NULL DEFAULT '',
    "audioAssetsJson" TEXT NOT NULL DEFAULT '[]',
    "imageStatus" TEXT NOT NULL DEFAULT 'idle',
    "imageError" TEXT NOT NULL DEFAULT '',
    "videoStatus" TEXT NOT NULL DEFAULT 'idle',
    "videoTaskId" TEXT NOT NULL DEFAULT '',
    "videoProgress" INTEGER NOT NULL DEFAULT 0,
    "videoError" TEXT NOT NULL DEFAULT '',
    "audioStatus" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL DEFAULT '',
    "sourceTaskId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL DEFAULT '',
    "characterId" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "taskId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "requestJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_requestKey_key" ON "Project"("requestKey");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "Character_projectId_idx" ON "Character"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_projectId_name_key" ON "Character"("projectId", "name");

-- CreateIndex
CREATE INDEX "Episode_projectId_episodeNumber_idx" ON "Episode"("projectId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_projectId_episodeNumber_key" ON "Episode"("projectId", "episodeNumber");

-- CreateIndex
CREATE INDEX "Scene_projectId_episodeId_idx" ON "Scene"("projectId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_episodeId_sceneNumber_key" ON "Scene"("episodeId", "sceneNumber");

-- CreateIndex
CREATE INDEX "Shot_projectId_episodeId_idx" ON "Shot"("projectId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_sceneId_shotNumber_key" ON "Shot"("sceneId", "shotNumber");

-- CreateIndex
CREATE INDEX "Asset_projectId_type_idx" ON "Asset"("projectId", "type");

-- CreateIndex
CREATE INDEX "Asset_shotId_idx" ON "Asset"("shotId");

-- CreateIndex
CREATE INDEX "AiTask_projectId_status_idx" ON "AiTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "AiTask_shotId_type_idx" ON "AiTask"("shotId", "type");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

