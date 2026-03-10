// Vercel Edge Function
import Replicate from 'replicate';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const voiceFile = formData.get('voice');
    const songId = formData.get('song');

    if (!voiceFile || !songId) {
      return new Response('Missing parameters', { status: 400 });
    }

    // 初始化Replicate客户端
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // 歌曲配置 - 已经处理好的歌曲URL
    const songConfigs = {
      'sunny': {
        name: '晴天',
        vocalsUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/qingtian_vocals.wav',
        instrumentalUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/qingtian_instrumental.mp3'
      },
      'rice': {
        name: '稻香',
        vocalsUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/daoxiang_vocals.wav',
        instrumentalUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/daoxiang_instrumental.mp3'
      },
      'resonance': {
        name: '人间共鸣',
        vocalsUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/renjiangongming_vocals.wav',
        instrumentalUrl: 'https://pub-7d3a3c3d4a5b4c6d7e8f9a0b1c2d3e4f.r2.dev/renjiangongming_instrumental.mp3'
      }
    };

    const song = songConfigs[songId];
    if (!song) {
      return new Response('Invalid song ID', { status: 400 });
    }

    // 将用户上传的声音文件转换为base64
    const voiceArrayBuffer = await voiceFile.arrayBuffer();
    const voiceBase64 = Buffer.from(voiceArrayBuffer).toString('base64');
    const voiceDataUri = `data:audio/wav;base64,${voiceBase64}`;

    // 调用Replicate的so-vits-svc模型
    console.log('开始调用Replicate API...');
    const output = await replicate.run(
      "cjwbw/so-vits-svc:4.0",
      {
        input: {
          // 用户上传的声音样本
          speaker_audio: voiceDataUri,
          // 要转换的歌曲干声
          input_audio: song.vocalsUrl,
          // 转换参数（调优用）
          f0_up_key: 0, // 音调调整，0为不变
          auto_predict_f0: true, // 自动预测音调
          cluster_infer_ratio: 0.0,
          noise_scale: 0.5,
          pad_seconds: 0.5,
          chunk_seconds: 30.0,
          db_thresh: -40
        }
      }
    );

    console.log('Replicate API调用完成，输出:', output);

    // output是转换后的人声音频URL
    const convertedVocalsUrl = output;

    // 这里可以添加混音逻辑：将转换后的人声和伴奏合并
    // 简单方案：直接返回转换后的人声，前端播放时可以同时播放伴奏
    // 进阶方案：用ffmpeg-wasm在前端混音，或者调用后端混音服务

    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      vocalsUrl: convertedVocalsUrl,
      instrumentalUrl: song.instrumentalUrl,
      // 如果你做了混音，可以直接返回完整歌曲URL
      // fullSongUrl: mixedUrl
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('生成失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
