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
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
  refreshToken: "YOUR_REFRESH_TOKEN"
};
const SERIES_URL = "https://laroza.bond/category.php?cat=ramadan-2026";

const MUSIC_URLS = [
  "https://www.myinstants.com/media/sounds/oi-oi-oe-oi-a-eye-eye.mp3",
  "https://www.myinstants.com/media/sounds/edit_xJn6sm3.mp3",
  "https://www.myinstants.com/media/sounds/naruto-trap_IJmMo7a.mp3",
  "https://www.myinstants.com/media/sounds/sound-of-silence-cyril-remix.mp3",
  "https://www.myinstants.com/media/sounds/dirigindo-meu-carro-funk_trim.mp3"
];

const WEBSITE_URL = "https://redirectauto4kiro.blogspot.com/";
const SITE_NAME = "كيرو زوزو";

// ========== دوال التنوع (Anti-Spam) ==========

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateDynamicTitle(episode) {
    const prefixes = ["شاهد الآن:", "متابعة ممتعة لـ", "تفاصيل مشوقة في", "حصرياً:", "لا يفوتك"];
    const emojis = ["✨", "🔥", "📺", "🌙", "🚀"];
    return `${getRandomElement(prefixes)} ${episode.title} - ${episode.episodeDisplay} ${getRandomElement(emojis)}`;
}

function generateDynamicDescription(episode, watchLink) {
    const intros = [
        `استمتع بمشاهدة ${episode.fullTitle} بجودة عالية.`,
        `إليك أحداث ${episode.fullTitle} كاملة كما عودناكم.`,
        `متابعة حصرية لدراما رمضان 2026 على منصتنا.`
    ];
    
    return `
${getRandomElement(intros)}

📥 لمتابعة الحلقة والتفاصيل:
🔗 ${watchLink}

✅ اشترك للمزيد من مسلسلات رمضان 2026.
#رمضان_2026 #مسلسلات #Shorts #${episode.shortTitle.replace(/\s+/g, '_')}
    `.trim();
}

// ========== الدوال التقنية ==========

async function downloadFile(url, outputPath) {
  try {
    const response = await axios({
      url: url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    await fs.writeFile(outputPath, response.data);
    return true;
  } catch (error) {
    return false;
  }
}

// إنشاء البوستر مع لمسة عشوائية في التصميم
async function createPoster(episode) {
  console.log('🎨 جاري إنشاء بوستر فريد...');
  
  const randomHue = Math.floor(Math.random() * 360); // لون عشوائي لمنع تطابق الصور
  const randomRotation = (Math.random() * 2 - 1).toFixed(1); // ميلان بسيط جداً
  
  let imageBase64 = '';
  if (await fs.pathExists('episode-image.jpg')) {
    const imageBuffer = await fs.readFile('episode-image.jpg');
    imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  }

  const html = `
  <html dir="rtl">
    <style>
      body { 
        background: #000; font-family: 'Cairo', sans-serif; 
        width: 1080px; height: 1920px; display: flex; align-items: center; justify-content: center;
      }
      .container {
        position: relative; width: 100%; height: 100%;
        background: url('${imageBase64}') center/cover;
        filter: hue-rotate(${randomHue}deg); /* تغيير بصمة الألوان */
        transform: rotate(${randomRotation}deg);
      }
      .overlay {
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent, rgba(0,0,0,0.9));
      }
      .content {
        position: relative; z-index: 10; color: white; text-align: center; padding-top: 200px;
      }
      .title { font-size: 80px; font-weight: 900; text-shadow: 4px 4px 10px #000; }
    </style>
    <body>
      <div class="container">
        <div class="overlay"></div>
        <div class="content">
          <div class="title">${episode.title}</div>
          <div style="font-size: 60px; color: #ffd700;">${episode.episodeDisplay}</div>
        </div>
      </div>
    </body>
  </html>`;

  await fs.writeFile('poster.html', html);
  return await convertHtmlToImage();
}

async function convertHtmlToImage() {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    const html = await fs.readFile('poster.html', 'utf8');
    await page.setContent(html);
    await page.screenshot({ path: 'poster.png' });
    await browser.close();
    return true;
  } catch (e) {
    console.log("⚠️ فشل تحويل الصورة، تأكد من تثبيت puppeteer");
    return false;
  }
}

async function createVideo(episode) {
  console.log('🎬 معالجة الفيديو بصرياً...');
  const musicFile = 'background-music.mp3';
  const musicUrl = getRandomElement(MUSIC_URLS);
  await downloadFile(musicUrl, musicFile);

  const randomSpeed = (0.0005 + Math.random() * 0.001).toFixed(4); // سرعة زووم متغيرة
  
  const command = `ffmpeg -y -loop 1 -i poster.png -i ${musicFile} \
    -filter_complex "[0:v]scale=1280:720,zoompan=z='min(1.1,zoom+${randomSpeed})':d=300:s=1080x1920[v]" \
    -map "[v]" -map 1:a -c:v libx264 -t 15 -pix_fmt yuv420p final-video.mp4`;

  await execPromise(command);
  return true;
}

async function uploadToYoutube(episode) {
  const oauth2Client = new google.auth.OAuth2(
    YOUTUBE_CONFIG.clientId, YOUTUBE_CONFIG.clientSecret, 'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_CONFIG.refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const videoTitle = generateDynamicTitle(episode);
  const watchLink = `${WEBSITE_URL}?hlk=${episode.episodeId}`;
  const videoDescription = generateDynamicDescription(episode, watchLink);

  await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: videoTitle.substring(0, 100),
        description: videoDescription,
        categoryId: '22'
      },
      status: { privacyStatus: 'public' }
    },
    media: {
      body: fs.createReadStream('final-video.mp4'),
      mimeType: 'video/mp4'
    }
  });
  console.log('✅ تم الرفع بنجاح بتفاصيل فريدة!');
}

// الدالة الأساسية للتشغيل
async function startAutomation() {
    try {
        // هنا تضع كود سحب بيانات الحلقة (extractEpisode) كما كان لديك
        // سنفترض أننا حصلنا على كائن episode
        const episode = { 
            title: "مسلسل العربجي", 
            episodeDisplay: "الحلقة 10", 
            episodeId: "abc123",
            fullTitle: "مسلسل العربجي الحلقة 10",
            shortTitle: "العربجي"
        };

        await createPoster(episode);
        await createVideo(episode);
        await uploadToYoutube(episode);
    } catch (e) {
        console.error("حدث خطأ:", e.message);
    }
}

startAutomation();
