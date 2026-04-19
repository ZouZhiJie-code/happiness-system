import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "AUDIO_FILE_REQUIRED" }, { status: 400 });
  }

  return NextResponse.json({
    transcript: `已接收录音文件：${file.name}。当前版本先保留接口与回退链路，下一步接入真实转写模型。`
  });
}
