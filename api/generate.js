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

    // 将用户上传的声音文件转换为base64
    const voiceArrayBuffer = await voiceFile.arrayBuffer();
    const voiceBase64 = Buffer.from(voiceArrayBuffer).toString('base64');
    const voiceDataUri = `data:audio/wav;base64,${voiceBase64}`;

    console.log('开始调用Replicate API...');
    
    // 直接用HTTP调用Replicate API，不用SDK，避免依赖问题
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'a82b15da344f8f5ef6a4e255ad8825b46b1d67e23c3a53456a59704c81d4e7b5',
        input: {
          speaker_audio: voiceDataUri,
          input_audio: song.vocalsUrl,
          auto_predict_f0: true,
          f0_up_key: 0,
          cluster_infer_ratio: 0.0,
          noise_scale: 0.5,
          pad_seconds: 0.5,
          chunk_seconds: 30.0,
          db_thresh: -40
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Replicate API error:', error);
      throw new Error(`Replicate API request failed: ${response.status} - ${error}`);
    }

    const prediction = await response.json();
    console.log('Prediction created:', prediction.id);

    // 轮询等待预测完成
    let output;
    while (true) {
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${replicateToken}`,
        }
      });

      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        output = status.output;
        break;
      }
      
      if (status.status === 'failed') {
        throw new Error(`Prediction failed: ${status.error}`);
      }
      
      // 等2秒再轮询
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Replicate API调用完成，输出:', output);

    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      vocalsUrl: output,
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
