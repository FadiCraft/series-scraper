const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { google } = require('googleapis');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// ========== الإعدادات ==========
const YOUTUBE_CONFIG = {
  clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "1//0402McOnnSfYTCgYIARAAGAQSNwF-L9IrHIeF6t-siXlEk4OREx_1gtOf8_8qEdHq3kDNHMnWpOMWyomF6FndgZvgiFwGYMyAwd4"
};
const SERIES_URL = "https://laroza.bond/category.php?cat=ramadan-2026";

const MUSIC_URLS = [
  "https://www.myinstants.com/media/sounds/oi-oi-oe-oi-a-eye-eye.mp3",
  "https://www.myinstants.com/media/sounds/edit_xJn6sm3.mp3",
  "https://www.myinstants.com/media/sounds/naruto-trap_IJmMo7a.mp3",
  "https://www.myinstants.com/media/sounds/sound-of-silence-cyril-remix.mp3",
  "https://www.myinstants.com/media/sounds/dirigindo-meu-carro-funk_trim.mp3",
  "https://www.myinstants.com/media/sounds/oi-mama-prishla-sonne-remix.mp3",
  "https://www.myinstants.com/media/sounds/super-idol-remix-2-0.mp3",
  "https://www.myinstants.com/media/sounds/jit-trippin-remix.mp3",
  "https://www.myinstants.com/media/sounds/among-us-remix-bass-boosted.mp3",
  "https://www.myinstants.com/media/sounds/indian-remix-christmas.mp3",
  "https://www.myinstants.com/media/sounds/all-star-smash-mouth-funk-remix-pmm7.mp3",
  "https://www.myinstants.com/media/sounds/20ad6161-13fc-40b1-a1f6-167b5b1d53b8.mp3",
  "https://www.myinstants.com/media/sounds/dilma-estocando-o-vento-remix-by-timbu.mp3",
  "https://www.myinstants.com/media/sounds/goo-goo-gagaaa.mp3",
  "https://www.myinstants.com/media/sounds/2021-04-07-213841761.mp3",
];

const WEBSITE_URL = "https://redirectauto4kiro.blogspot.com/";
const SITE_NAME = "كيرو زوزو";

// ========== دوال مساعدة ==========
function getRandomMusic() {
  return MUSIC_URLS[Math.floor(Math.random() * MUSIC_URLS.length)];
}

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
    return 30;
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

// تحويل مدة الفيديو من نص إلى ثواني
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
    console.log('⚠️ استخدام بيانات تجريبية');
    return {
      id: 1,
      title: 'وديمه وحليمه',
      fullTitle: 'وديمه وحليمه الحلقة 5',
      thumbnail: 'https://via.placeholder.com/600x900/1a1a1a/e50914?text=LAROOZA',
      link: 'https://laroza.bond/video.php?vid=test123',
      duration: '45:00',
      episodeNumber: 5,
      episodeId: 'test123',
      keywords: ['وديمه وحليمه', 'مسلسل', 'رمضان 2026']
    };
  }

  const $ = cheerio.load(html);
  const episodes = [];

  // استخراج الحلقات
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
      
      // استخراج الصورة
      let thumbnail = '';
      const imgEl = $(el).find('img');
      if (imgEl.length) {
        thumbnail = imgEl.attr('src') || imgEl.attr('data-src') || '';
        if (thumbnail && !thumbnail.startsWith('http')) {
          const baseUrl = new URL(SERIES_URL);
          thumbnail = baseUrl.origin + '/' + thumbnail.replace(/^\/+/, '');
        }
      }
      
      // استخراج العنوان
      let title = $(el).find('.ellipsis').text() || 
                  linkEl.attr('title') || 
                  imgEl.attr('alt') ||
                  `حلقة ${episodes.length + 1}`;
      
      // استخراج المدة
      let duration = '';
      $(el).find('.duration, .pm-label-duration, [class*="time"]').each((i, durEl) => {
        const text = $(durEl).text().trim();
        if (text && (text.includes(':') || text.match(/\d+/))) {
          duration = text;
          return false;
        }
      });
      
      episodes.push({
        link: fullLink,
        thumbnail: thumbnail,
        title: title.replace(/[\n\r\t]/g, ' ').trim(),
        duration: duration || '30:00'
      });
    } catch (e) {
      // تجاهل الأخطاء الفردية
    }
  });

  if (episodes.length === 0) {
    throw new Error('لم يتم العثور على حلقات');
  }

  console.log(`✅ تم العثور على ${episodes.length} حلقة`);
  
  const selectedEpisode = episodes[Math.floor(Math.random() * episodes.length)];
  console.log(`✅ تم اختيار: ${selectedEpisode.link}`);

  return await extractEpisodeDetails(selectedEpisode);
}

async function extractEpisodeDetails(episode) {
  console.log('🔍 جاري استخراج تفاصيل الحلقة...');
  
  try {
    const response = await axios.get(episode.link, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    let fullTitle = '';
    let keywords = [];
    let thumbnail = episode.thumbnail;
    
    // استخراج العنوان
    const metaTitle = $('meta[name="title"]').attr('content');
    if (metaTitle) {
      fullTitle = metaTitle.trim();
    } else {
      fullTitle = $('h1').first().text().trim() || 
                  $('.title').first().text().trim() || 
                  episode.title;
    }
    
    // استخراج الكلمات المفتاحية
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      keywords = metaKeywords.split(',').map(k => k.trim());
    }
    
    // استخراج الصورة
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) {
      thumbnail = twitterImage.startsWith('http') ? twitterImage : 'https:' + twitterImage;
    } else {
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        thumbnail = ogImage;
      }
    }
    
    // استخراج رقم الحلقة
    let episodeNumber = 1;
    let cleanTitle = fullTitle; // عنوان نظيف بدون رقم الحلقة

    // محاولة استخراج رقم الحلقة بعدة طرق
    const episodePatterns = [
      /الحلقة\s*(\d+)/i,                    // الحلقة 4
      /\b(\d+)\s*الرابعة\b/i,                // 4 الرابعة
      /\b(\d+)\s*الخامسة\b/i,                 // 5 الخامسة
      /episode\s*(\d+)/i,                     // episode 4
      /e(\d+)/i,                              // e4
      /part\s*(\d+)/i,                        // part 4
      /-\s*(\d+)\s*-/i,                       // -4-
      /[^\d](\d+)[^\d]/i                      // أي رقم منفرد
    ];

    for (const pattern of episodePatterns) {
      const match = fullTitle.match(pattern);
      if (match) {
        episodeNumber = parseInt(match[1]);
        
        // إزالة رقم الحلقة من العنوان
        cleanTitle = fullTitle.replace(match[0], '').trim();
        
        // تنظيف العنوان من الكلمات الزائدة
        cleanTitle = cleanTitle
          .replace(/الحلقة\s*\d+\s*الرابعة/g, '')  // الحلقة 4 الرابعة
          .replace(/الحلقة\s*\d+/g, '')            // الحلقة 4
          .replace(/episode\s*\d+/gi, '')          // episode 4
          .replace(/[-\s]+$/g, '')                  // إزالة الشرطات والمسافات من النهاية
          .replace(/^[-\s]+/g, '')                   // إزالة الشرطات والمسافات من البداية
          .trim();
        
        console.log(`✅ تم استخراج: العنوان="${cleanTitle}", رقم الحلقة=${episodeNumber}`);
        break;
      }
    }

    // إذا لم نجد رقم حلقة، نستخدم الاسم الافتراضي
    if (cleanTitle === fullTitle) {
      // محاولة استخراج الاسم الأساسي (قبل أول رقم)
      const parts = fullTitle.split(/[-\s]+/);
      let nameParts = [];
      for (const part of parts) {
        if (isNaN(part) || part.match(/[^\d]/)) {
          nameParts.push(part);
        } else {
          break;
        }
      }
      cleanTitle = nameParts.join(' ') || fullTitle;
    }
    
    // استخراج المدة
    let duration = episode.duration;
    $('.duration, .time, [class*="duration"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.includes(':')) {
        duration = text;
        return false;
      }
    });
    
    const episodeId = extractEpisodeId(episode.link);
    
    console.log('✅ تم استخراج التفاصيل:');
    console.log(`📺 العنوان: ${fullTitle}`);
    console.log(`🆔 ID الحلقة: ${episodeId}`);
    console.log(`🔢 رقم الحلقة: ${episodeNumber}`);
    
    // تحميل الصورة
    if (thumbnail) {
      try {
        await downloadFile(thumbnail, 'episode-image.jpg');
        console.log('✅ تم تحميل صورة الحلقة');
      } catch (e) {
        console.log('⚠️ فشل تحميل الصورة');
      }
    }
    
    return {
      id: episodeNumber,
      title: cleanTitle,                    // ✅ عنوان نظيف بدون رقم
      fullTitle: fullTitle,                  // العنوان الكامل للاحتياط
      shortTitle: cleanTitle,                // نفس العنوان النظيف
      episodeNumber: episodeNumber,           // رقم الحلقة منفصل
      episodeDisplay: `الحلقة ${episodeNumber}`, // نص منسق للحلقة
      thumbnail: thumbnail,
      link: episode.link,
      duration: duration,
      durationSeconds: durationToSeconds(duration),
      episodeId: episodeId,
      keywords: keywords.length > 0 ? keywords : [cleanTitle.split(' ')[0], 'مسلسل', 'رمضان 2026']
    };
    
  } catch (error) {
    console.log(`❌ فشل استخراج التفاصيل: ${error.message}`);
    
    // في حالة الخطأ، نستخدم بيانات من episode الأصلي
    return {
      id: episode.episodeNumber || 1,
      title: episode.title || 'مسلسل',
      fullTitle: episode.title || 'مسلسل',
      shortTitle: episode.title || 'مسلسل',
      episodeNumber: episode.episodeNumber || 1,
      episodeDisplay: `الحلقة ${episode.episodeNumber || 1}`,
      thumbnail: episode.thumbnail || '',
      link: episode.link || '',
      duration: episode.duration || '30:00',
      durationSeconds: durationToSeconds(episode.duration || '30:00'),
      episodeId: episode.episodeId || 'X',
      keywords: ['مسلسل', 'رمضان 2026']
    };
  }
}

// ========== 2️⃣ إنشاء البوستر بالتصميم الجديد (مطابق لكود HTML) ==========
async function createPoster(episode) {
  console.log('🎨 جاري إنشاء البوستر بالتصميم الجديد...');
  
  let imageBase64 = '';
  
  if (await fs.pathExists('episode-image.jpg')) {
    const imageBuffer = await fs.readFile('episode-image.jpg');
    imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  } else {
    imageBase64 = episode.thumbnail || 'https://via.placeholder.com/1080x1920/1a1a1a/e50914?text=No+Image';
  }
  
  // دالة تنسيق العنوان مع توسيط مثالي
  const formatTitle = (title) => {
    const words = title.split(' ');
    let output = '<div class="title-container">';
    
    if (words.length <= 3) {
      // إذا كان العنوان قصيراً (كلمتين أو ثلاث)
      output += `<div class="title-line center-title">${title}</div>`;
    } else {
      // إذا كان العنوان طويلاً، نقسمه لأسطر
      for(let i = 0; i < words.length; i += 3) {
        const lineWords = words.slice(i, i + 3);
        output += `<div class="title-line">${lineWords.join(' ')}</div>`;
      }
    }
    
    output += '</div>';
    return output;
  };
  
  const formattedTitle = formatTitle(episode.title); // العنوان بدون رقم
  
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${episode.fullTitle} | رمضان 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
            .overlay-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, 
                rgba(0,0,0,0.9) 0%, 
                transparent 40%, 
                rgba(0,0,0,0.8) 100%);
            z-index: 2;
        }
                .overlay-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, 
                rgba(0,0,0,0.9) 0%, 
                transparent 40%, 
                rgba(0,0,0,0.8) 100%);
            z-index: 2;
        }

        /* 👇 أضف الكود الجديد هنا */
        .overlay-color {
            position: absolute;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(184,134,11,0.3) 100%);
            z-index: 1;
            mix-blend-mode: overlay;
        }
        :root {
            --primary-gold: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
            --accent-color: #ffd700;
            --glass: rgba(255, 255, 255, 0.1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: 'Cairo', sans-serif;
        }

        .reels-poster {
            width: 1080px;
            height: 1920px;
            position: relative;
            overflow: hidden;
            border-radius: 60px;
            background: #000;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }

        .bg-img {
            position: absolute;
            width: 100%;
            height: 100%;
            background-image: url('${imageBase64}');
            background-size: cover;
            background-position: center;
            filter: brightness(0.7);
            transition: 0.5s;
        }

        .overlay-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, 
                rgba(0,0,0,0.9) 0%, 
                transparent 40%, 
                rgba(0,0,0,0.8) 100%);
            z-index: 2;
        }

        .poster-content {
            position: relative;
            z-index: 10;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 80px 40px;
            text-align: center;
        }

        .badge-ramadan {
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,215,0,0.4);
            padding: 15px 40px;
            border-radius: 60px;
            display: inline-block;
            align-self: center;
            color: var(--accent-color);
            font-weight: 900;
            font-size: 36px;
            box-shadow: 0 0 30px rgba(255,215,0,0.2);
        }

        .main-title-box {
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            padding: 40px;
            border-radius: 40px;
            border-right: 6px solid var(--accent-color);
            border-left: 6px solid var(--accent-color);
            margin: 40px 0;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stars-rating {
            color: var(--accent-color);
            font-size: 60px;
            letter-spacing: 15px;
            margin: 30px 0;
            text-shadow: 0 0 30px rgba(255,215,0,0.5);
        }

        .quality-text {
            font-size: 36px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px #000;
        }

        .brand-name {
            font-size: 70px;
            font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #b8860b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }

        .btn-link {
            background: linear-gradient(135deg, #ffd700, #b8860b);
            color: #000;
            padding: 25px 40px;
            border-radius: 80px;
            font-weight: 900;
            font-size: 48px;
            display: block;
            width: fit-content;
            max-width: 90%;
            margin: 30px auto;
            box-shadow: 0 20px 40px rgba(184,134,11,0.5);
            border: 4px solid white;
            text-align: center;
            direction: rtl;
            word-break: break-word;
            line-height: 1.4;
            animation: glow 3s infinite;
        }

        .footer-brand {
            color: rgba(255,255,255,0.8);
            font-size: 36px;
            letter-spacing: 4px;
            border-top: 2px solid rgba(255,215,0,0.3);
            padding-top: 30px;
            margin-top: 30px;
            font-weight: 600;
        }

        /* تعديلات للعناوين الطويلة */
        .main-title-box:has(.title-line:nth-child(4)) .title-line {
            font-size: 60px;
        }
        
        .main-title-box:has(.title-line:nth-child(5)) .title-line {
            font-size: 50px;
        }

        /* تحريك خفيف */
        @keyframes glow {
            0% { box-shadow: 0 20px 40px rgba(184,134,11,0.5); }
            50% { box-shadow: 0 30px 60px rgba(255,215,0,0.8); }
            100% { box-shadow: 0 20px 40px rgba(184,134,11,0.5); }
        }

        .btn-link {
            animation: glow 3s infinite;
        }

        .episode-number {
            font-size: 90px;
            font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #b8860b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            line-height: 1;
            text-shadow: 0 0 30px rgba(255,215,0,0.5);
        }

        .episode-text {
            font-size: 40px;
            color: white;
            opacity: 0.9;
            font-weight: 600;
        }

        .center-title {
            text-align: center;
            width: 100%;
            display: block;
        }

        /* تحسينات التوسيط للعنوان */
        .title-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            text-align: center;
        }

        .title-line {
            font-size: 70px;
            font-weight: 900;
            line-height: 1.3;
            text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
            color: white;
            margin: 10px 0;
            text-align: center;
            width: 100%;
        }

        .episode-badge {
            margin: 30px auto 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            background: rgba(255, 215, 0, 0.1);
            backdrop-filter: blur(5px);
            padding: 20px 40px;
            border-radius: 60px;
            border: 2px solid rgba(255, 215, 0, 0.3);
            width: fit-content;
        }
    </style>
</head>
<body>
    <div class="reels-poster">
        <div class="bg-img"></div>
        <div class="overlay-color"></div>  <!-- 👈 أضف هذا السطر -->
        <div class="overlay-gradient"></div>
        <div class="poster-content">
            <div class="badge-ramadan">
                🌙 رمضان 2026
            </div>
            
            <div class="main-title-box" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                ${formattedTitle}
                ${episode.episodeNumber ? `
                <div class="episode-badge" style="margin: 20px auto 0 auto;">
                        <span class="episode-text">  الحلقة</span>
                    <span class="episode-number">${episode.episodeNumber}</span>
                </div>` : ''}
            </div>

            <div>
                <div class="stars-rating"></div>
                
                <div class="quality-text">رابط الحلقة بالوصف</div>
                <div class="brand-name">شـــاهـــد الأن</div>
                
                <div class="btn-link">
 اضغط على الرابط بالوصف
</div>
                
                <div class="footer-brand">
                    WWW.KIROZOZO.XYZ
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  await fs.writeFile('poster.html', html);
  console.log('✅ تم إنشاء البوستر بالتصميم الجديد (poster.html)');
  
  // محاولة تحويل HTML إلى صورة
  const converted = await convertHtmlToImage();
  
  return converted;
}

// تحويل HTML إلى صورة
async function convertHtmlToImage() {
  // الطريقة 1: استخدام wkhtmltoimage
  try {
    console.log('🔄 محاولة استخدام wkhtmltoimage...');
    await execPromise('wkhtmltoimage --version');
    
    try {
      await execPromise('xvfb-run wkhtmltoimage --width 1080 --height 1920 --format png poster.html poster.png');
    } catch {
      await execPromise('wkhtmltoimage --width 1080 --height 1920 --format png poster.html poster.png');
    }
    
    if (await fs.pathExists('poster.png')) {
      console.log('✅ تم تحويل البوستر إلى صورة باستخدام wkhtmltoimage');
      return true;
    }
  } catch (e) {
    console.log('⚠️ wkhtmltoimage فشل:', e.message);
  }
  
  // الطريقة 2: استخدام puppeteer
  try {
    console.log('🔄 محاولة استخدام puppeteer...');
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    
    const html = await fs.readFile('poster.html', 'utf8');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'poster.png', fullPage: true, type: 'png' });
    
    await browser.close();
    
    if (await fs.pathExists('poster.png')) {
      console.log('✅ تم تحويل البوستر إلى صورة باستخدام puppeteer');
      return true;
    }
  } catch (e) {
    console.log('⚠️ puppeteer فشل:', e.message);
  }
  
  return false;
}

// ========== 3️⃣ إنشاء الفيديو ==========
async function createVideo(episode) {
  console.log('🎬 جاري إنشاء الفيديو...');
  
  try {
    await execPromise('ffmpeg -version');
    
    // تحديد مصدر الصورة
    let imageSource = null;
    let useImage = false;
    
    if (await fs.pathExists('poster.png')) {
      imageSource = 'poster.png';
      useImage = true;
      console.log('📸 استخدام صورة البوستر');
    }
    
    // تحميل الموسيقى
    const musicUrl = getRandomMusic();
    console.log(`🎵 تحميل موسيقى: ${musicUrl}`);
    
    const musicFile = 'background-music.mp3';
    const musicDownloaded = await downloadFile(musicUrl, musicFile);
    
    if (!musicDownloaded) {
      throw new Error('فشل تحميل الموسيقى');
    }
    
    const musicDuration = await getVideoDuration(musicFile);
    console.log(`⏱️ مدة الموسيقى: ${musicDuration} ثانية`);
    
    // مدة الفيديو (30 ثانية على الأقل)
    const videoDuration = Math.max(musicDuration, 30);
    
    // أمر FFmpeg
    let command;
    
    if (useImage && imageSource) {
      // استخدام الصورة مع تأثير zoom بسيط
      command = `
        ffmpeg -y \
        -loop 1 -i "${imageSource}" \
        -i "${musicFile}" \
        -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(1+0.001*on,1.05)':d=${Math.round(videoDuration * 30)}:s=1080x1920:fps=30,format=yuv420p[v]" \
        -map "[v]" -map 1:a \
        -c:v libx264 -preset fast -crf 23 \
        -c:a aac -b:a 128k \
        -t ${videoDuration} \
        -shortest \
        -movflags +faststart \
        final-video.mp4
      `;
    } else {
      // استخدام HTML مع فيديو أسود
      const safeTitle = episode.shortTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      command = `
        ffmpeg -y \
        -f lavfi -i color=c=black:s=1080x1920:d=${videoDuration}:r=30 \
        -i "${musicFile}" \
        -filter_complex "[0:v]drawtext=text='${safeTitle}':fontcolor=white:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf,format=yuv420p[v]" \
        -map "[v]" -map 1:a \
        -c:v libx264 -preset ultrafast -crf 18 \
        -c:a aac -b:a 128k \
        -t ${videoDuration} \
        -shortest \
        final-video.mp4
      `;
    }
    
    await execPromise(command);
    console.log('✅ تم إنشاء الفيديو (final-video.mp4)');
    
    if (await fs.pathExists('final-video.mp4')) {
      const stats = await fs.stat('final-video.mp4');
      console.log(`📊 حجم الفيديو: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      return true;
    } else {
      throw new Error('فشل إنشاء ملف الفيديو');
    }
    
  } catch (error) {
    console.log('⚠️ فشل إنشاء الفيديو:', error.message);
    
    // فيديو احتياطي بسيط
    try {
      console.log('🔄 إنشاء فيديو احتياطي...');
      
      const safeTitle = episode.shortTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const simpleCommand = `
        ffmpeg -y \
        -f lavfi -i color=c=black:s=1080x1920:d=30:r=30 \
        -f lavfi -i anullsrc \
        -vf "drawtext=text='${safeTitle}':fontcolor=white:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" \
        -c:v libx264 -preset ultrafast \
        -c:a aac \
        -t 30 \
        final-video.mp4
      `;
      
      await execPromise(simpleCommand);
      console.log('✅ تم إنشاء فيديو احتياطي');
      return true;
    } catch (e) {
      console.log('❌ فشل إنشاء الفيديو الاحتياطي:', e.message);
      return false;
    }
  }
}

// ========== 4️⃣ رفع الفيديو إلى يوتيوب ==========
async function uploadToYoutube(episode) {
  console.log('📤 جاري رفع الفيديو إلى يوتيوب...');
  
  try {
    if (!YOUTUBE_CONFIG.clientId || !YOUTUBE_CONFIG.clientSecret || !YOUTUBE_CONFIG.refreshToken) {
      console.log('⚠️ بيانات يوتيوب غير مكتملة');
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_CONFIG.clientId,
      YOUTUBE_CONFIG.clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: YOUTUBE_CONFIG.refreshToken
    });

    // التحقق من صلاحية التوكن
    try {
      await oauth2Client.getAccessToken();
    } catch (tokenError) {
      console.log('⚠️ توكن التحديث غير صالح:', tokenError.message);
      return null;
    }

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const videoTitle = episode.fullTitle.substring(0, 90);
    const watchLink = `${WEBSITE_URL}?hlk=${episode.episodeId}`;
    
    // بناء الكلمات المفتاحية
    const keywords = [
      ...episode.keywords.slice(0, 10),
      episode.shortTitle,
      'مسلسلات رمضان',
      'رمضان 2026',
      'شاهد الآن',
      SITE_NAME
    ].filter(k => k && k.length > 0).map(k => k.trim());
    
    const uniqueKeywords = [...new Set(keywords)];
    
    const videoDescription = `
✨ ${episode.fullTitle} - ${SITE_NAME}

📺 شاهد الحلقة كاملة على ${SITE_NAME}:
🔗 ${watchLink}

⏱️ مدة الحلقة الكاملة: ${episode.duration}

✅ لا تنسى الاشتراك في القناة وتفعيل الجرس 🔔

${uniqueKeywords.slice(0, 10).map(k => `#${k.replace(/[^\w\u0600-\u06FF]/g, '_')}`).join(' ')}

#مسلسلات_رمضان #${episode.shortTitle.replace(/\s+/g, '_')}_${episode.episodeNumber} #لاروزا #شاهد_الآن
#shorts #reels #رمضان_2026 #كيرو_زوزو
    `.trim();

    console.log('📹 عنوان الفيديو:', videoTitle);
    
    if (!await fs.pathExists('final-video.mp4')) {
      throw new Error('ملف الفيديو غير موجود');
    }
    
    console.log('⏳ جاري الرفع...');
    
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          tags: uniqueKeywords.slice(0, 15),
          categoryId: '22'
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream('final-video.mp4'),
        mimeType: 'video/mp4'
      }
    });
  
    console.log('✅✅✅ تم رفع الفيديو بنجاح!');
    console.log('🔗 رابط الفيديو: https://youtube.com/watch?v=' + response.data.id);
    console.log('🔗 رابط شورت: https://youtube.com/shorts/' + response.data.id);
    
    return response.data.id;
    
  } catch (error) {
    console.error('❌ خطأ في الرفع:', error.message);
    
    if (error.message.includes('exceeded the number of videos')) {
      console.log('⚠️ تم تجاوز حد الرفع اليومي');
    } else if (error.message.includes('invalid_grant')) {
      console.log('⚠️ توكن التحديث منتهي الصلاحية');
    }
    
    return null;
  }
}

// ========== 5️⃣ حفظ البيانات ==========
async function saveData(episode, videoId) {
  const data = {
    title: episode.fullTitle,
    seriesTitle: episode.shortTitle,
    episodeNumber: episode.episodeNumber,
    episodeId: episode.episodeId,
    duration: episode.duration,
    durationSeconds: episode.durationSeconds,
    watchLink: `${WEBSITE_URL}?hlk=${episode.episodeId}`,
    siteName: SITE_NAME,
    keywords: episode.keywords,
    reelsUrl: videoId ? `https://youtube.com/shorts/${videoId}` : null,
    youtubeUrl: videoId ? `https://youtube.com/watch?v=${videoId}` : null,
    date: new Date().toISOString(),
    videoId: videoId
  };
  
  await fs.writeJson('reels-data.json', data, { spaces: 2 });
  console.log('✅ تم حفظ البيانات في reels-data.json');
  
  // إنشاء ملف تعليمات للرفع اليدوي
  if (!videoId) {
    const instructions = `
📋 تعليمات رفع الفيديو يدوياً:

📹 عنوان الفيديو:
${episode.fullTitle}

📝 الوصف:
✨ ${episode.fullTitle} - ${SITE_NAME}

📺 شاهد الحلقة كاملة على ${SITE_NAME}:
🔗 ${WEBSITE_URL}?hlk=${episode.episodeId}

⏱️ مدة الحلقة الكاملة: ${episode.duration}

✅ لا تنسى الاشتراك في القناة وتفعيل الجرس 🔔

${episode.keywords.slice(0, 5).map(k => `#${k.replace(/[^\w\u0600-\u06FF]/g, '_')}`).join(' ')}

#مسلسلات_رمضان #${episode.shortTitle.replace(/\s+/g, '_')}_${episode.episodeNumber} #لاروزا #شاهد_الآن
#shorts #reels #رمضان_2026 #كيرو_زوزو

📁 الملفات الجاهزة:
- poster.png (صورة البوستر)
- poster.html (البوستر HTML)
- episode-image.jpg (صورة الحلقة)
- final-video.mp4 (الفيديو)
- reels-data.json (بيانات الرفع)
    `;
    
    await fs.writeFile('upload-instructions.txt', instructions);
    console.log('✅ تم إنشاء تعليمات الرفع في upload-instructions.txt');
  }
}

// ========== 🚀 الدالة الرئيسية ==========
async function main() {
  console.log('='.repeat(60));
  console.log('🚀 بوت نشر الريلز - رمضان 2026');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  let episode = null;
  let videoId = null;
  
  try {
    // 1️⃣ استخراج الحلقة
    episode = await extractEpisode();
    
    // 2️⃣ إنشاء البوستر حسب التصميم الجديد
    await createPoster(episode);
    
    // 3️⃣ إنشاء الفيديو
    const videoCreated = await createVideo(episode);
    
    if (!videoCreated) {
      throw new Error('فشل إنشاء الفيديو');
    }
    
    // 4️⃣ رفع إلى يوتيوب
    videoId = await uploadToYoutube(episode);
    
    // 5️⃣ حفظ البيانات
    await saveData(episode, videoId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('='.repeat(60));
    console.log('📊 ملخص العملية:');
    console.log(`⏱️ الوقت: ${duration} ثانية`);
    console.log(`📺 المسلسل: ${episode.fullTitle}`);
    console.log(`🆔 رقم الحلقة: ${episode.episodeNumber}`);
    console.log(`🆔 ID الحلقة: ${episode.episodeId}`);
    console.log(`🔗 رابط المشاهدة: ${WEBSITE_URL}?hlk=${episode.episodeId}`);
    console.log(`⏱️ مدة الحلقة: ${episode.duration}`);
    
    if (videoId) {
      console.log('✅✅✅ تم النشر بنجاح!');
      console.log('📺 رابط اليوتيوب: https://youtube.com/shorts/' + videoId);
    } else {
      console.log('⚠️ تم إنشاء الملفات محلياً:');
      console.log('   - poster.png (صورة البوستر)');
      console.log('   - poster.html (البوستر)');
      console.log('   - episode-image.jpg (صورة الحلقة)');
      console.log('   - final-video.mp4 (الفيديو)');
      console.log('   - upload-instructions.txt (تعليمات الرفع)');
    }
    
    console.log('='.repeat(60));
    
    // عرض معلومات إضافية
    console.log('\n📦 الملفات الناتجة:');
    const files = await fs.readdir('.');
    const ourFiles = files.filter(f => 
      f.includes('poster') || 
      f.includes('episode') || 
      f.includes('final-video') || 
      f.includes('reels-data') || 
      f.includes('upload-instructions') ||
      f.includes('background-music')
    );
    
    for (const file of ourFiles) {
      const stats = await fs.stat(file);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    }
    
  } catch (error) {
    console.error('❌ خطأ:', error);
    
    await fs.writeJson('error.json', {
      error: error.message,
      stack: error.stack,
      date: new Date().toISOString()
    }, { spaces: 2 });
    
    process.exit(1);
  }
}

// ========== تشغيل البرنامج ==========
if (require.main === module) {
  main().catch(console.error);
}

// ========== تصدير الدوال ==========
module.exports = { 
  main, 
  extractEpisode, 
  createPoster, 
  createVideo, 
  uploadToYoutube,
  saveData
};
