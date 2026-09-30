export default (input) => `将下列故事人物扩展为可复用的文字人物设定。只输出 JSON：{"characters":[{"name":"","age":"","gender":"","identity":"","personality":"","appearance":"","voiceProfile":"","relationships":""}]}。请专注人物身份、性格、人物关系与故事动机，不生成图片 Prompt。
角色信息：${JSON.stringify(input.characters)}
故事：${JSON.stringify(input.story)}`;