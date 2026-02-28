const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const { google } = require('googleapis');
const { exec } = require('child_process');
const util = require('util');
const googleTTS = require('google-tts-api');

const execPromise = util.promisify(exec);

const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//04HafPqhYssCbCgYIARAAGAQSNwF-L9IrYzZJy2ssGac1EdAhImYb6LCyO7ukYnDWyp-gJCiUYz_DMqW64L4_sukg00tStq2aSqM"
};

const SERIES_URL = "https://laroza.bond/category.php?cat=ramadan-2026";

async function downloadFile(url, outputPath) {
  try {
    const response = await axios({ url, method: 'GET', responseType: 'arraybuffer', timeout: 15000 });
    await fs.writeFile(outputPath, response.data);
    return true;
  } catch (e) { return false; }
}

async function run() {
  console.log('🚀 بدء العملية المطورة...');
  
  try {
    // 1. استخراج البيانات
    const resp = await axios.get(SERIES_URL);
    const $ = cheerio.load(resp.data);
    const title = $('a[href*="video.php"]').first().attr('title') || "مسلسل رمضاني جديد";
    console.log(`✅ تم اختيار: ${title}`);

    // 2. توليد الصوت (التعليق الصوتي)
    console.log('🎙️ توليد التعليق الصوتي...');
    const voiceText = `شاهد الآن تفاصيل مسلسل ${title}. الرابط متوفر حالياً في أول تعليق مثبت أسفل الفيديو. لا تنسى الاشتراك للمزيد.`;
    const audioUrl = googleTTS.getAudioUrl(voiceText, { lang: 'ar', slow: false });
    await downloadFile(audioUrl, 'voice.mp3');

    // 3. إنشاء الفيديو باستخدام FFmpeg مباشرة (حل مشكلة البوستر)
    // سنصنع خلفية ملونة وعليها النص مباشرة بدلاً من استخدام Puppeteer المعقد
    console.log('🎬 إنشاء الفيديو عبر FFmpeg...');
    const ffmpegCmd = `
      ffmpeg -y \
      -f lavfi -i color=c='0x1a1a1a':s=1080x1920:d=12 \
      -i voice.mp3 \
      -vf "drawtext=text='${title}':fontcolor=white:fontsize=70:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf, \
           drawtext=text='التفاصيل في أول تعليق':fontcolor=yellow:fontsize=50:x=(w-text_w)/2:y=(h-text_h)/2+150:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" \
      -c:v libx264 -preset fast -c:a aac -shortest final.mp4
    `;
    
    await execPromise(ffmpegCmd);
    console.log('✅ تم إنشاء الفيديو بنجاح');

    // 4. الرفع (تأكد من وجود الأسرار في GitHub)
    if (await fs.pathExists('final.mp4')) {
      const oauth2Client = new google.auth.OAuth2(YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret, 'https://developers.google.com/oauthplayground');
      oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: { title: `${title} - أخبار ومواعيد 📺`, description: `التفاصيل في أول تعليق`, categoryId: '24' },
          status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('final.mp4') }
      });
      console.log('🚀 تم النشر بنجاح على يوتيوب!');
    }

  } catch (err) {
    console.error('❌ فشل السكريبت:', err.message);
  }
}

run();
