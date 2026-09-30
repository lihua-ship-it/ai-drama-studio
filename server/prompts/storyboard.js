export default (input) => `把剧本拆成适合AI视频生成的连续镜头，只输出 JSON：{"shots":[{"episodeNumber":1,"sceneNumber":1,"shotNumber":1,"shotType":"中景","cameraAngle":"平视","cameraMovement":"缓慢推近","duration":5,"characterNames":["角色名"],"action":"可见动作","dialogue":[{"characterName":"","text":"","emotion":"neutral","voiceId":"","speed":1}],"emotion":"","imagePrompt":"","negativePrompt":"","videoPrompt":"","continuity":{"previousShotNumber":0,"characterState":"","positionState":"","clothingState":"","environmentState":"","propState":""},"firstFramePrompt":"","lastFramePrompt":""}]}。每个场景至少2镜；相邻镜头 continuity 继承人物外貌、服装、方位、场景和道具；Prompt不得生成字幕。
风格：${input.visualStyle}
分集剧情：${JSON.stringify(input.episodes)}
完整场景与对白：${JSON.stringify(input.scenes)}
人物锁定描述：${JSON.stringify(input.characters)}`;