// Vercel Edge Function - Kits.ai 专业歌声转换实现（带详细日志）
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    console.log('=== 收到新的生成请求 ===');
    
    const formData = await request.formData();
    const voiceFile = formData.get('voice');
    const songId = formData.get('song');

    console.log('请求参数:', { songId, hasVoiceFile: !!voiceFile });

    if (!voiceFile || !songId) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少参数：voice或songId'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 歌曲配置
    const songConfigs = {
      'sunny': {
        name: '晴天',
        songUrl: 'https://github.com/bufapang/songsongsong/raw/main/songs/qingtian_duan.mp3'
      },
      'rice': {
        name: '稻香',
        songUrl: 'https://github.com/bufapang/songsongsong/raw/main/songs/daoxiang_duan.mp3'
      },
      'resonance': {
        name: '人间共鸣',
        songUrl: 'https://github.com/bufapang/songsongsong/raw/main/songs/renjiangongming_duan.mp3'
      }
    };

    const song = songConfigs[songId];
    if (!song) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的歌曲ID'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 获取Kits.ai API Key
    const kitsApiKey = process.env.KITS_API_KEY;
    console.log('KITS_API_KEY是否存在:', !!kitsApiKey);
    
    if (!kitsApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Kits.ai API Key 未配置，请在Vercel环境变量中添加KITS_API_KEY'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 先返回模拟成功，方便测试前端流程
    console.log('返回模拟数据');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return new Response(JSON.stringify({
      success: true,
      songName: song.name,
      convertedVocalsUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      instrumentalUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      message: '生成成功！'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('服务器错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `内部错误：${error.message || '未知错误'}`
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
