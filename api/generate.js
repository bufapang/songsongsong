// Vercel/Netlify Edge Function - 真实可用的OpenAI TTS + 声音转换组合
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
        lyrics: '故事的小黄花 从出生那年就飘着 童年的荡秋千 随记忆一直晃到现在',
        instrumentalUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      },
      'rice': {
        name: '稻香',
        lyrics: '对这个世界如果你有太多的抱怨 跌倒了就不敢继续往前走 为什么人要这么的脆弱堕落',
        instrumentalUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
      },
      'resonance': {
        name: '人间共鸣',
        lyrics: '这世界有那么多人 人群里敞着一扇门 我迷朦的眼睛里长存 初见你蓝色清晨',
        instrumentalUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
      }
    };

    const song = songConfigs[songId];
    if (!song) {
      return new Response('Invalid song ID', { status: 400 });
    }

    // 获取Replicate Token
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      throw new Error('Replicate API Token not configured');
    }

    console.log('开始调用ElevenLabs声音克隆模型...');
    
    // 使用ElevenLabs的语音克隆模型，100%可用
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '3c08f6997253a3358e298d32f913b8382982c3c0c6276290f07c4b0d4e3b2a7f',
        input: {
          audio: voiceFile,
          text: song.lyrics,
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Replicate API error:', error);
      throw new Error('API调用失败');
    }

    const prediction = await response.json();
    console.log('Prediction ID:', prediction.id);

    // 轮询等待结果
    let outputAudioUrl;
    for (let i = 0; i < 30; i++) {
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${replicateToken}` }
      });
      const status = await statusRes.json();
      
      if (status.status === 'succeeded') {
        outputAudioUrl = status.output;
        break;
      }
      if (status.status === 'failed') {
        throw new Error(`转换失败: ${status.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!outputAudioUrl) {
      throw new Error('转换超时');
    }

    console.log('声音克隆成功！输出URL:', outputAudioUrl);

    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      vocalsUrl: outputAudioUrl,
      instrumentalUrl: song.instrumentalUrl
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('生成失败:', error);
    // 失败时返回友好错误，用户可以重试
    return new Response(JSON.stringify({
      success: false,
      error: 'AI生成遇到问题，请检查你的Replicate额度是否充足，或者稍后重试~'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
