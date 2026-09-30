export default (input) => `为每个分镜重写适配豆包 Seedream 的中文图片 Prompt 与 Seedance 视频 Prompt。只输出 JSON：{"shots":[{"shotId":"原样返回输入 shotId","imagePrompt":"","negativePrompt":"","videoPrompt":"","firstFramePrompt":"","lastFramePrompt":""}]}。必须逐镜头返回、shotId不变。构图为16:9电影画面；将角色面部、发型、体态、服装锁定描述自然写入对应镜头；继承 continuity 的人物位置、道具和环境；图片不可出现文字或水印。
视觉风格：${input.style}
镜头与角色信息：${JSON.stringify(input.shots)}`;