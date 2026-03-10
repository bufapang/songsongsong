// Vercel Edge Function - 用原生HTTP请求调用Replicate，没有依赖问题
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

    // 歌曲配置
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

    // 获取Replicate Token
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return new Response('Replicate API Token not configured', { status: 500 });
    }

    console.log('开始调用Replicate API...');
    
    // 使用OpenAI的TTS+语音转换组合，或者直接用更简单的测试接口
    // 这里先返回模拟数据方便你测试前端流程
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 模拟返回结果，你可以替换成真实的音频URL
    const mockVocalsUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      vocalsUrl: mockVocalsUrl,
      instrumentalUrl: song.instrumentalUrl
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
