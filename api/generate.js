// Vercel/Netlify Edge Function - 真实RVC歌声转换
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
        vocalsUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/jay-chou-sunny-vocals.wav',
        instrumentalUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/jay-chou-sunny-instrumental.mp3'
      },
      'rice': {
        name: '稻香',
        vocalsUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/jay-chou-rice-vocals.wav',
        instrumentalUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/jay-chou-rice-instrumental.mp3'
      },
      'resonance': {
        name: '人间共鸣',
        vocalsUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/lijian-resonance-vocals.wav',
        instrumentalUrl: 'https://huggingface.co/datasets/umutto/demo-audio/resolve/main/lijian-resonance-instrumental.mp3'
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

    // 将用户上传的声音文件转换为base64
    const voiceArrayBuffer = await voiceFile.arrayBuffer();
    const voiceBase64 = Buffer.from(voiceArrayBuffer).toString('base64');
    const voiceDataUri = `data:audio/wav;base64,${voiceBase64}`;

    console.log('开始调用RVC模型进行声音转换...');
    
    // 使用最新的RVC v2模型，转换效果非常好
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '735f6264c5b89f9b08802e44538c4f6c2d763e0a94e54f4c4e066b7e8d3b3c5a',
        input: {
          input_audio: song.vocalsUrl,
          reference_audio: voiceDataUri,
          f0_up_key: 0,
          auto_f0: true,
          index_rate: 0.75,
          filter_radius: 3,
          rms_mix_rate: 0.25,
          protect: 0.33
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Replicate API error:', error);
      throw new Error(`API request failed: ${response.status}`);
    }

    const prediction = await response.json();
    console.log('Prediction ID:', prediction.id);

    // 轮询等待结果
    let outputAudioUrl;
    const maxAttempts = 60; // 最多等2分钟
    for (let i = 0; i < maxAttempts; i++) {
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${replicateToken}` }
      });
      const status = await statusRes.json();
      
      if (status.status === 'succeeded') {
        outputAudioUrl = status.output;
        break;
      }
      if (status.status === 'failed') {
        throw new Error(`Conversion failed: ${status.error || 'Unknown error'}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!outputAudioUrl) {
      throw new Error('Conversion timed out');
    }

    console.log('转换成功！输出URL:', outputAudioUrl);

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
    // 失败时返回友好提示，用户可以重试
    return new Response(JSON.stringify({
      success: false,
      error: 'AI生成暂时遇到问题，请重试~'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
