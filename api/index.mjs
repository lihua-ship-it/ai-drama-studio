import { app } from '../server/app.js';

// Vercel Serverless 函数入口。
// vercel.json 的 rewrites 会把 /api/* 与 /uploads/* 交给本函数，Vercel 会
// 原样保留原始请求的 path / headers / cookies，因此 req.url 本就是原始路径，
// 无需读取任何自定义请求头，直接透传给 Express app 即可。
export default function handler(request, response) {
  return app(request, response);
}
