const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { google } = require('googleapis');
const { exec } = require('child_process');
const util = require('util');
const googleTTS = require('google-tts-api'); // 👈 المكتبة الجديدة للصوت

const execPromise = util.promisify(exec);

// ========== الإعدادات ==========
const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//04HafPqhYssCbCgYIARAAGAQSNwF-L9IrYzZJy2ssGac1EdAhImYb6LCyO7ukYnDWyp-gJCiUYz_DMqW64L4_sukg00tStq2aSqM"
};
const SERIES_URL = "https://laroza.bond/category.php?cat=ramadan-2026";
const WEBSITE_URL = "https://redirectauto4kiro.blogspot.com/";
const SITE_NAME = "كيرو زوزو";

// ========== دوال مساعدة ==========
async function downloadFile(url, outputPath) {
  try {
    const response = await axios({
      url: url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    await fs.writeFile(outputPath, response.data);
    console.log(`✅ تم تحميل: ${outputPath}`);
    return true;
  } catch (error) {
    console.log(`❌ فشل تحميل الملف: ${error.message}`);
    return false;
  }
}

async function getVideoDuration(videoPath) {
  try {
    const { stdout } = await execPromise(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    return parseFloat(stdout);
  } catch (error) {
    console.log(`⚠️ فشل الحصول على مدة الفيديو: ${error.message}`);
    return 30; // افتراضي
  }
}

function extractEpisodeId(link) {
  try {
    const urlParams = new URLSearchParams(link.split('?')[1]);
    return urlParams.get('vid') || 'X';
  } catch {
    return 'X';
  }
}

function durationToSeconds(duration) {
  if (!duration) return 1800;
  const parts = duration.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 1800;
}

// ========== 1️⃣ استخراج معلومات الحلقة ==========
async function extractEpisode() {
  console.log('🔍 جاري استخراج معلومات الحلقة من لاروزا...');
  
  const proxies = [
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    ''
  ];

  let html = null;
  
  for (const proxy of proxies) {
    try {
      const proxyUrl = proxy ? proxy + encodeURIComponent(SERIES_URL) : SERIES_URL;
      console.log(`محاولة الاتصال عبر: ${proxy || 'اتصال مباشر'}`);
      
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (response.data && response.data.includes('video.php')) {
        html = response.data;
        console.log(`✅ تم الاتصال عبر ${proxy || 'اتصال مباشر'}`);
        break;
      }
    } catch (e) {
      console.log(`❌ فشل مع ${proxy || 'اتصال مباشر'}: ${e.message}`);
    }
  }

  if (!html) {
    console.log('⚠️ استخدام بيانات تجريبية لعدم القدرة على الوصول للموقع');
    return {
      id: 1, title: 'وديمه وحليمه', fullTitle: 'وديمه وحليمه الحلقة 5',
      thumbnail: 'https://via.placeholder.com/600x900/1a1a1a/e50914?text=LAROOZA',
      link: 'https://laroza.bond/video.php?vid=test123', duration: '45:00',
      episodeNumber: 5, episodeId: 'test123', keywords: ['وديمه وحليمه', 'مسلسل', 'رمضان 2026']
    };
  }

  const $ = cheerio.load(html);
  const episodes = [];

  $('li.col-xs-6, li.col-sm-4, li.col-md-3, .episode-item, .video-item').each((i, el) => {
    if (episodes.length >= 15) return false;
    try {
      const linkEl = $(el).find('a[href*="video.php"]');
      if (!linkEl.length) return;
      const episodeLink = linkEl.attr('href');
      let fullLink = episodeLink;
      if (!episodeLink.startsWith('http')) {
        const baseUrl = new URL(SERIES_URL);
        fullLink = baseUrl.origin + '/' + episodeLink.replace(/^\/+/, '');
      }
      let thumbnail = '';
      const imgEl = $(el).find('img');
      if (imgEl.length) {
        thumbnail = imgEl.attr('src') || imgEl.attr('data-src') || '';
        if (thumbnail && !thumbnail.startsWith('http')) {
          const baseUrl = new URL(SERIES_URL);
          thumbnail = baseUrl.origin + '/' + thumbnail.replace(/^\/+/, '');
        }
      }
      let title = $(el).find('.ellipsis').text() || linkEl.attr('title') || imgEl.attr('alt') || `حلقة ${episodes.length + 1}`;
      let duration = '';
      $(el).find('.duration, .pm-label-duration, [class*="time"]').each((i, durEl) => {
        const text = $(durEl).text().trim();
        if (text && (text.includes(':') || text.match(/\d+/))) { duration = text; return false; }
      });
      episodes.push({
        link: fullLink, thumbnail: thumbnail, title: title.replace(/[\n\r\t]/g, ' ').trim(), duration: duration || '30:00'
      });
    } catch (e) {}
  });

  if (episodes.length === 0) throw new Error('لم يتم العثور على حلقات');
  const selectedEpisode = episodes[Math.floor(Math.random() * episodes.length)];
  return await extractEpisodeDetails(selectedEpisode);
}

async function extractEpisodeDetails(episode) {
  console.log('🔍 جاري استخراج تفاصيل الحلقة...');
  try {
    const response = await axios.get(episode.link, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const $ = cheerio.load(response.data);
    let fullTitle = $('meta[name="title"]').attr('content')?.trim() || $('h1').first().text().trim() || episode.title;
    let keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [];
    let thumbnail = episode.thumbnail;
    
    let episodeNumber = 1;
    let cleanTitle = fullTitle;
    const episodePatterns = [/الحلقة\s*(\d+)/i, /\b(\d+)\s*الرابعة\b/i, /episode\s*(\d+)/i, /e(\d+)/i];

    for (const pattern of episodePatterns) {
      const match = fullTitle.match(pattern);
      if (match) {
        episodeNumber = parseInt(match[1]);
        cleanTitle = fullTitle.replace(match[0], '').trim().replace(/[-\s]+$/g, '').trim();
        break;
      }
    }

    const episodeId = extractEpisodeId(episode.link);
    if (thumbnail) await downloadFile(thumbnail, 'episode-image.jpg');
    
    return {
      id: episodeNumber, title: cleanTitle, fullTitle: fullTitle, shortTitle: cleanTitle,
      episodeNumber: episodeNumber, thumbnail: thumbnail, link: episode.link,
      duration: episode.duration, episodeId: episodeId,
      keywords: keywords.length > 0 ? keywords : [cleanTitle.split(' ')[0], 'مسلسلات', 'اخبار الفن']
    };
  } catch (error) {
    console.log(`❌ فشل استخراج التفاصيل: ${error.message}`);
    return episode; // عودة للبيانات الأساسية في حال الخطأ
  }
}

// ========== 2️⃣ إنشاء البوستر ==========
async function createPoster(episode) {
  console.log('🎨 جاري إنشاء البوستر...');
  let imageBase64 = '';
  
  if (await fs.pathExists('episode-image.jpg')) {
    const imageBuffer = await fs.readFile('episode-image.jpg');
    imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  } else {
    imageBase64 = episode.thumbnail || 'https://via.placeholder.com/1080x1920/1a1a1a/e50914';
  }
  
  // نفس كود HTML الخاص بك تقريباً مع تعديلات بسيطة
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; background: #000; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .reels-poster { width: 1080px; height: 1920px; position: relative; overflow: hidden; background: #000; }
        .bg-img { position: absolute; width: 100%; height: 100%; background-image: url('${imageBase64}'); background-size: cover; background-position: center; filter: brightness(0.5); }
        .content { position: relative; z-index: 10; color: white; text-align: center; padding-top: 300px; }
        h1 { font-size: 80px; text-shadow: 2px 2px 10px #000; color: #ffd700; }
        .badge { background: rgba(255,0,0,0.8); padding: 20px 40px; font-size: 50px; border-radius: 20px; display: inline-block; margin-top: 50px; }
    </style>
</head>
<body>
    <div class="reels-poster">
        <div class="bg-img"></div>
        <div class="content">
            <h1>أخبار مسلسل<br>${episode.title}</h1>
            <div class="badge">الحلقة ${episode.episodeNumber || ''}</div>
            <br><br><br>
            <h2 style="font-size: 60px;">تفاصيل ومواعيد العرض<br>الرابط في أول تعليق 👇</h2>
        </div>
    </div>
</body>
</html>`;

  await fs.writeFile('poster.html', html);
  await convertHtmlToImage();
}

async function convertHtmlToImage() {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    const html = await fs.readFile('poster.html', 'utf8');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'poster.png', type: 'png' });
    await browser.close();
    console.log('✅ تم تحويل البوستر إلى صورة');
    return true;
  } catch (e) {
    console.log('⚠️ فشل إنشاء الصورة:', e.message);
    return false;
  }
}

// ========== 3️⃣ إنشاء الفيديو (بالصوت والحركة) ==========
async function createVideo(episode) {
  console.log('🎬 جاري إنشاء فيديو احترافي (Shorts)...');
  
  try {
    let imageSource = 'poster.png';
    if (!(await fs.pathExists(imageSource))) throw new Error('صورة البوستر غير موجودة');

    console.log('🎙️ جاري توليد التعليق الصوتي الذكي...');
    const textToSpeak = `تفاصيل وموعد عرض مسلسل ${episode.title} الحلقة ${episode.episodeNumber}. لمعرفة كافة التفاصيل، تفضل بزيارة الرابط الموجود في أول تعليق مثبت. مشاهدة ممتعة!`;
    
    // جلب رابط الصوت من جوجل
    const audioUrl = googleTTS.getAudioUrl(textToSpeak, { lang: 'ar', slow: false, host: 'https://translate.google.com' });
    const audioFile = 'voiceover.mp3';
    await downloadFile(audioUrl, audioFile);
    
    // إضافة ثانية صمت لتجنب القطع المفاجئ
    const command = `
      ffmpeg -y \
      -loop 1 -i "${imageSource}" \
      -i "${audioFile}" \
      -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=crop,zoompan=z='min(1.15,zoom+0.0005)':d=900:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920[v];[1:a]apad=pad_dur=2[a]" \
      -map "[v]" -map "[a]" \
      -c:v libx264 -preset fast -pix_fmt yuv420p -crf 23 \
      -c:a aac -b:a 128k \
      -shortest \
      -movflags +faststart \
      final-video.mp4
    `;
    
    await execPromise(command);
    console.log('✅ تم إنشاء الفيديو المتحرك بنجاح');
    return true;
  } catch (error) {
    console.log('⚠️ خطأ أثناء إنشاء الفيديو:', error.message);
    return false;
  }
}

// ========== 4️⃣ الرفع على يوتيوب (آمن) ==========
async function uploadToYoutube(episode) {
  console.log('📤 جاري رفع الفيديو إلى يوتيوب...');
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_CONFIG.clientId,
      YOUTUBE_CONFIG.clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // تعديل العنوان والوصف ليكون "مراجعة وأخبار" لتقليل المخاطر
    const safeTitle = `تفاصيل وموعد عرض مسلسل ${episode.title} الحلقة ${episode.episodeNumber} 📺🔥`.substring(0, 95);
    const safeDescription = `تغطية أخبار وتفاصيل ${episode.title}.\n\n🎬 لمعرفة التفاصيل كاملة، تفقد أول تعليق مثبت!\n\n#${episode.title.replace(/\s+/g, '_')} #مسلسلات #رمضان`;

    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: safeTitle,
          description: safeDescription,
          tags: ['مسلسلات', 'أخبار الفن', 'مراجعة مسلسلات', episode.title],
          categoryId: '24' // 24 = Entertainment
        },
        status: {
          privacyStatus: 'public', // أو 'private' للتجربة
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream('final-video.mp4')
      }
    });

    console.log(`✅ تم رفع الفيديو بنجاح! رابط الفيديو: https://youtube.com/shorts/${res.data.id}`);
    return res.data.id; // نُعيد الـ ID لنتمكن من وضع تعليق لاحقاً
  } catch (error) {
    console.log('❌ خطأ في الرفع ليوتيوب:', error.message);
    return null;
  }
}

// ========== دالة التشغيل الرئيسية ==========
async function runAutoUploader() {
  console.log('🚀 بدء عملية النشر التلقائي...');
  try {
    const episode = await extractEpisode();
    await createPoster(episode);
    const videoCreated = await createVideo(episode);
    
    if (videoCreated) {
      const videoId = await uploadToYoutube(episode);
      if (videoId) {
        console.log(`🎉 اكتملت العملية بنجاح للفيديو: ${videoId}`);
        // هنا يمكننا إضافة دالة لكتابة التعليق المثبت لاحقاً
      }
    }
  } catch (error) {
    console.error('❌ حدث خطأ فادح:', error);
  } finally {
    // تنظيف الملفات المؤقتة
    try {
      await fs.remove('episode-image.jpg');
      await fs.remove('poster.html');
      await fs.remove('poster.png');
      await fs.remove('voiceover.mp3');
      await fs.remove('final-video.mp4');
      console.log('🧹 تم تنظيف الملفات المؤقتة');
    } catch (e) {}
  }
}

// تشغيل السكريبت
runAutoUploader();
