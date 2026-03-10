// Vercel Edge Function - Kits.ai 专业歌声转换实现
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

    // 歌曲配置 - 替换为你上传的三首歌URL
    const songConfigs = {
      'sunny': {
        name: '晴天',
        songUrl: 'https://your-domain.com/songs/qingtian.mp3'
      },
      'rice': {
        name: '稻香',
        songUrl: 'https://your-domain.com/songs/daoxiang.mp3'
      },
      'resonance': {
        name: '人间共鸣',
        songUrl: 'https://your-domain.com/songs/renjiangongming.mp3'
      }
    };

    const song = songConfigs[songId];
    if (!song) {
      return new Response('Invalid song ID', { status: 400 });
    }

    // 获取Kits.ai API Key
    const kitsApiKey = process.env.KITS_API_KEY;
    if (!kitsApiKey) {
      throw new Error('Kits.ai API Key not configured');
    }

    console.log('=== 开始Kits.ai歌声转换流程 ===');

    // ------------------------------
    // 步骤1：训练用户专属音色模型
    // ------------------------------
    console.log('步骤1：创建音色模型...');
    const voiceModelForm = new FormData();
    voiceModelForm.append('name', `user_voice_${Date.now()}`);
    voiceModelForm.append('files', voiceFile, 'user_voice.wav');
    voiceModelForm.append('is_public', 'false');
    voiceModelForm.append('description', 'User voice for singing conversion');

    const modelResponse = await fetch('https://api.kits.ai/v1/voice_models', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kitsApiKey}`
      },
      body: voiceModelForm
    });

    if (!modelResponse.ok) {
      const error = await modelResponse.text();
      console.error('创建音色模型失败:', error);
      throw new Error('音色训练失败');
    }

    const modelData = await modelResponse.json();
    const modelId = modelData.id;
    console.log('✅ 音色模型创建成功，ID:', modelId);

    // 等待模型训练完成
    let modelReady = false;
    for (let i = 0; i < 30; i++) {
      const statusResponse = await fetch(`https://api.kits.ai/v1/voice_models/${modelId}`, {
        headers: { 'Authorization': `Bearer ${kitsApiKey}` }
      });
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'ready') {
        modelReady = true;
        break;
      }
      if (statusData.status === 'failed') {
        throw new Error('音色训练失败');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!modelReady) {
      throw new Error('音色训练超时');
    }

    // ------------------------------
    // 步骤2：分离歌曲人声和伴奏
    // ------------------------------
    console.log('步骤2：分离歌曲人声和伴奏...');
    const separationResponse = await fetch('https://api.kits.ai/v1/vocal_separation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kitsApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: song.songUrl,
        separation_model: 'vr_model_1' // 专业歌声分离模型
      })
    });

    if (!separationResponse.ok) {
      const error = await separationResponse.text();
      console.error('人声分离失败:', error);
      throw new Error('人声分离失败');
    }

    const separationData = await separationResponse.json();
    const sourceVocalUrl = separationData.vocals_url;
    const instrumentalUrl = separationData.instrumental_url;
    console.log('✅ 人声分离完成');

    // ------------------------------
    // 步骤3：音色转换 - 用用户声音替换原人声
    // ------------------------------
    console.log('步骤3：开始音色转换...');
    const conversionResponse = await fetch('https://api.kits.ai/v1/kits_voice_conversion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kitsApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voice_model_id: modelId,
        source_audio_url: sourceVocalUrl,
        f0_adjustment: 0, // 音调不变
        pitch_extraction_method: 'crepe', // 最准确的音调提取
        formant_shift: 0,
        noise_reduction: 0.3,
        auto_tune_strength: 0.2 // 轻微修音，更自然
      })
    });

    if (!conversionResponse.ok) {
      const error = await conversionResponse.text();
      console.error('音色转换失败:', error);
      throw new Error('音色转换失败');
    }

    const conversionData = await conversionResponse.json();
    const convertedVocalUrl = conversionData.output_url;
    console.log('✅ 音色转换完成');

    // ------------------------------
    // 步骤4：混音合成完整歌曲（可选，前端也可以做）
    // ------------------------------
    console.log('✅ 所有步骤完成！');

    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      convertedVocalsUrl: convertedVocalUrl,
      instrumentalUrl: instrumentalUrl,
      // 如果你做了后端混音，这里返回完整歌曲URL
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
      error: error.message || '生成失败，请重试'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
