const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '8351599421307503563',
    clientId: '676395600013-5gmnle6clg9f5mqfo7uci45nqurl0hsi.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//05-y_lVbQzPs1CgYIARAAGAUSNwF-L9IrtEhFugmwQXjaGN--8EVbAZZwmAGlroNEXUey43nFiT6hg0MGAHqaKU_oJtdXH_1lFrw'
};

// ===== الإعدادات العامة =====
const SETTINGS = {
    targetUrl: 'https://larooza.life/category.php?cat=ramadan-2026',
    baseUrl: 'https://larooza.life',
    stateFile: 'state.json',
    postsDir: 'posts',
    maxEpisodes: 30,
    siteName: 'كيروزوزو',
    siteUrl: 'https://www.kirozozo.xyz/'
};

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
    }

    loadState() {
        try {
            return fs.readJsonSync(SETTINGS.stateFile);
        } catch {
            return { 
                published: [], 
                lastDate: null, 
                index: 0,
                totalPublished: 0
            };
        }
    }

    saveState() {
        fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
    }

    async fetchHtml(url) {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ar,en-US;q=0.7,en;q=0.3'
            },
            timeout: 10000
        });
        return res.data;
    }

    // دالة استخراج الصورة من صفحة الحلقة
    async extractImageFromEpisodePage(episodeUrl) {
        try {
            console.log(`🖼️ استخراج الصورة من صفحة الحلقة...`);
            
            const html = await this.fetchHtml(episodeUrl);
            const $ = cheerio.load(html);
            
            // محاولة استخراج og:image
            let image = $('meta[property="og:image"]').attr('content');
            
            // إذا ما لقينا، نجرب طرق ثانية
            if (!image) {
                image = $('meta[name="twitter:image"]').attr('content');
            }
            if (!image) {
                image = $('meta[itemprop="image"]').attr('content');
            }
            if (!image) {
                // آخر خيار: أول صورة في الصفحة
                image = $('img').first().attr('src');
            }
            
            // تأكد من الرابط كامل
            if (image && !image.startsWith('http')) {
                if (image.startsWith('//')) {
                    image = 'https:' + image;
                } else {
                    const baseUrl = new URL(episodeUrl).origin;
                    image = baseUrl + (image.startsWith('/') ? image : '/' + image);
                }
            }
            
            if (image) {
                console.log(`✅ تم استخراج الصورة: ${image.substring(0, 50)}...`);
            } else {
                console.log('⚠️ لم يتم العثور على صورة');
            }
            
            return image || null;
            
        } catch (error) {
            console.log('❌ فشل استخراج الصورة:', error.message);
            return null;
        }
    }

    async getAllEpisodes() {
        console.log('📥 جلب الحلقات من لاروزا...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        const episodes = [];
        const imagePromises = [];

        $('li.col-xs-6, li.col-sm-4, li.col-md-3').each((i, el) => {
            const $el = $(el);
            
            let link = $el.find('a').first().attr('href');
            if (link && !link.startsWith('http')) {
                link = SETTINGS.baseUrl + (link.startsWith('/') ? link : '/' + link);
            }
            
            let title = $el.find('.ellipsis').text().trim() || $el.find('a').text().trim();
            title = title.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
            
            const duration = $el.find('.pm-label-duration').text().trim() || 'غير محدد';

            if (title && link && title !== 'عنوان غير معروف') {
                const episode = {
                    id: i + 1,
                    title: title,
                    link: link,
                    image: null,
                    duration: duration,
                    servers: [],
                    views: Math.floor(Math.random() * 20000) + 5000,
                    rating: (Math.random() * 2 + 3).toFixed(1),
                    likes: Math.floor(Math.random() * 2000) + 500
                };
                
                episodes.push(episode);
                
                imagePromises.push(
                    this.extractImageFromEpisodePage(episode.link)
                        .then(img => { episode.image = img; })
                        .catch(() => {})
                );
            }
        });

        console.log('🔄 جاري تحميل الصور من صفحات الحلقات...');
        await Promise.all(imagePromises);
        
        console.log(`✅ تم العثور على ${episodes.length} حلقة مع الصور`);
        return episodes.slice(0, SETTINGS.maxEpisodes);
    }

    async getEpisodeServers(episodeUrl) {
        try {
            const playUrl = episodeUrl.replace('video.php', 'play.php');
            console.log(`🔍 استخراج السيرفرات من: ${playUrl}`);
            
            const html = await this.fetchHtml(playUrl);
            const $ = cheerio.load(html);
            const servers = [];

            $('.WatchList li').each((i, el) => {
                const url = $(el).attr('data-embed-url');
                let name = $(el).find('strong').text().trim() || `سيرفر ${i + 1}`;
                
                if (name.includes('Vid')) name = name.replace('Vid', 'VidHD');
                if (name.includes('Ok')) name = 'Ok Prime';
                if (name.includes('VK')) name = 'VK Video';
                
                if (url) {
                    servers.push({ 
                        name, 
                        url: url.startsWith('//') ? 'https:' + url : url,
                        id: `server${i + 1}`
                    });
                }
            });

            return servers;
        } catch (error) {
            console.log('⚠️ فشل استخراج السيرفرات:', error.message);
            return [];
        }
    }

    generatePostHtml(episode) {
        const serversHtml = episode.servers.map(s => 
            `<button class="server-btn" data-server="${s.id}">${s.name}</button>`
        ).join('');

        const iframesHtml = episode.servers.map(s => `
            <div class="iframe-container" id="${s.id}">
                <div class="iframe-placeholder">
                    <div class="play-icon-large" data-url="${s.url}">▶</div>
                    <div>${s.name}</div>
                    <div class="watch-instruction">انقر على زر التشغيل لمشاهدة الحلقة</div>
                </div>
            </div>
        `).join('');

        const viewsFormatted = episode.views.toLocaleString();
        const likesFormatted = episode.likes.toLocaleString();
        const backgroundImage = episode.image || 'https://via.placeholder.com/1200x600';

        return `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: white; padding: 20px; }
    .main-container {
      align-items: center;
      background-image: linear-gradient(to right, rgba(0,0,0,.85), rgba(0,0,0,.4)), url('${backgroundImage}');
      background-position: center center;
      background-repeat: no-repeat;
      background-size: cover;
      border-radius: 15px;
      color: white;
      display: flex;
      justify-content: space-between;
      padding: 60px 40px;
      position: relative;
      margin: 20px 0;
    }
    .content-main { flex: 1; margin-right: 30px; max-width: 70%; }
    .thumbnail-card {
      border-radius: 8px;
      box-shadow: rgba(0, 0, 0, 0.5) 0px 4px 12px;
      height: 120px;
      width: 200px;
      overflow: hidden;
      position: relative;
    }
    .thumbnail-card img { height: 100%; object-fit: cover; width: 100%; }
    .thumbnail-overlay {
      align-items: center;
      background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.7));
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: center;
      left: 0;
      position: absolute;
      top: 0;
      width: 100%;
    }
    .play-button {
      align-items: center;
      background: rgba(245, 197, 24, 0.9);
      border-radius: 50%;
      display: flex;
      height: 40px;
      justify-content: center;
      margin-bottom: 8px;
      width: 40px;
    }
    .play-button span { color: black; font-size: 18px; margin-left: 2px; }
    .thumbnail-text { color: white; font-size: 11px; font-weight: bold; line-height: 1.3; margin: 0; text-align: center; }
    .thumbnail-text span { color: #f5c518; }
    h1 { font-size: 48px; margin-bottom: 10px; }
    .rating-stats {
      display: flex;
      gap: 20px;
      margin: 15px 0;
      flex-wrap: wrap;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.05);
      padding: 8px 15px;
      border-radius: 8px;
    }
    .stat-item i { color: #f5c518; }
    .meta-info { font-size: 14px; opacity: 0.9; }
    .description { color: #dddddd; line-height: 1.7; margin-top: 20px; max-width: 600px; }
    .player-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 28px;
      font-size: 18px;
      cursor: pointer;
      background: #f5c518;
      border-radius: 6px;
      color: black;
      font-weight: bold;
      margin-right: 10px;
      text-decoration: none;
      border: none;
    }
    .site-link {
      border-radius: 6px;
      border: 1px solid white;
      color: white;
      display: inline-block;
      padding: 12px 22px;
      text-decoration: none;
    }
    .servers-container { margin-top: 40px; width: 100%; }
    .servers-title {
      font-size: 24px;
      margin-bottom: 20px;
      color: #f5c518;
      border-bottom: 2px solid #f5c518;
      padding-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .server-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 30px;
    }
    .server-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      padding: 12px 20px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 140px;
      text-align: center;
    }
    .server-btn:hover { background: rgba(245, 197, 24, 0.2); border-color: #f5c518; }
    .server-btn.active { background: rgba(245, 197, 24, 0.9); color: black; border-color: #f5c518; }
    .iframe-container {
      width: 100%;
      height: 500px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: none;
    }
    .iframe-container.active { display: block; }
    .iframe-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ccc;
      font-size: 18px;
    }
    .play-icon-large {
      font-size: 60px;
      color: #f5c518;
      margin-bottom: 20px;
      cursor: pointer;
    }
    .watch-instruction {
      margin-top: 20px;
      font-size: 16px;
      color: #aaa;
      text-align: center;
      max-width: 80%;
      line-height: 1.5;
    }
    .footer-link {
      text-align: center;
      margin: 30px 0;
    }
    .footer-link a {
      display: inline-block;
      background: #f5c518;
      color: black;
      padding: 15px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 18px;
    }
    @media (max-width: 768px) {
      .main-container { flex-direction: column; padding: 30px 20px; }
      .content-main { margin-right: 0; max-width: 100%; margin-bottom: 30px; }
      .thumbnail-card { width: 100%; max-width: 300px; margin: 0 auto; }
      h1 { font-size: 36px; }
      .iframe-container { height: 350px; }
    }
  </style>
</head>
<body>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${episode.title}",
    "description": "مشاهدة وتحميل ${episode.title} كاملة بجودة عالية اون لاين",
    "thumbnailUrl": "${episode.image || 'https://via.placeholder.com/1200x600'}",
    "uploadDate": "${new Date().toISOString()}",
    "duration": "${episode.duration}",
    "contentUrl": "${episode.link}",
    "embedUrl": "${episode.link}",
    "interactionCount": "${episode.views}",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "${episode.rating}",
      "ratingCount": "${episode.likes}",
      "bestRating": "5",
      "worstRating": "1"
    },
    "publisher": {
      "@type": "Organization",
      "name": "${SETTINGS.siteName}",
      "url": "${SETTINGS.siteUrl}"
    }
  }
  </script>

  <div class="main-container">
    <div class="thumbnail-card">
      <img alt="${episode.title}" src="${episode.image || 'https://via.placeholder.com/200x120'}" />
      <div class="thumbnail-overlay">
        <div class="play-button"><span>▶</span></div>
        <p class="thumbnail-text">تشغيل<br /><span>${episode.title.substring(0, 20)}...</span></p>
      </div>
    </div>

    <div class="content-main">
      <h1>${episode.title}</h1>
      
      <div class="rating-stats">
        <div class="stat-item"><i class="fas fa-star"></i><span>${episode.rating} / 5</span></div>
        <div class="stat-item"><i class="fas fa-eye"></i><span>${viewsFormatted} مشاهدة</span></div>
        <div class="stat-item"><i class="fas fa-thumbs-up"></i><span>${likesFormatted} إعجاب</span></div>
      </div>
      
      <p class="meta-info">⭐ ${episode.rating} &nbsp; | &nbsp; ${episode.duration} &nbsp; | &nbsp; مسلسل رمضان 2026 &nbsp; | &nbsp; حلقات جديدة</p>
      
      <p class="description">مشاهدة وتحميل ${episode.title} كاملة بجودة عالية اون لاين ، تدور احداث الحلقة في إطار درامي مشوق......</p>
      
      <div style="margin-top: 30px;">
        <a href="#" id="watchBtn" class="player-btn"><span style="margin-left: 5px;">▶</span> مشاهدة الآن</a>
        <a href="${SETTINGS.siteUrl}" target="_blank" class="site-link"><i class="fas fa-external-link-alt"></i> زيارة موقع ${SETTINGS.siteName}</a>
      </div>
      
      <div class="servers-container" id="serversSection" style="display: none;">
        <div class="servers-title"><span>📺</span> سيرفرات المشاهدة</div>
        <div class="server-buttons">${serversHtml}</div>
        ${iframesHtml}
      </div>
    </div>
  </div>

  <div class="footer-link">
    <a href="${SETTINGS.siteUrl}" target="_blank"><i class="fas fa-external-link-alt"></i> لمزيد من الأفلام والمسلسلات زوروا موقع ${SETTINGS.siteName}</a>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', function() {
    const watchBtn = document.getElementById('watchBtn');
    const serversSection = document.getElementById('serversSection');
    
    if (watchBtn && serversSection) {
      watchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (serversSection.style.display === 'none' || serversSection.style.display === '') {
          serversSection.style.display = 'block';
          watchBtn.innerHTML = '<span style="margin-left: 5px;">▲</span> إخفاء السيرفرات';
          serversSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          serversSection.style.display = 'none';
          watchBtn.innerHTML = '<span style="margin-left: 5px;">▶</span> مشاهدة الآن';
        }
      });
    }
    
    const serverButtons = document.querySelectorAll('.server-btn');
    const iframeContainers = document.querySelectorAll('.iframe-container');
    
    if (serverButtons.length > 0) {
      serverButtons[0].classList.add('active');
      if (iframeContainers.length > 0) {
        iframeContainers[0].classList.add('active');
      }
    }
    
    serverButtons.forEach(button => {
      button.addEventListener('click', function() {
        const serverId = this.getAttribute('data-server');
        serverButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        iframeContainers.forEach(container => container.classList.remove('active'));
        document.getElementById(serverId).classList.add('active');
      });
    });
    
    const playIcons = document.querySelectorAll('.play-icon-large');
    playIcons.forEach(icon => {
      icon.addEventListener('click', function() {
        const videoUrl = this.getAttribute('data-url');
        const container = this.closest('.iframe-container');
        container.innerHTML = \`<iframe src="\${videoUrl}" width="100%" height="100%" frameborder="0" allowfullscreen style="border: none;"></iframe>\`;
        showMessage('✅ جاري تشغيل الحلقة...');
      });
    });
    
    function showMessage(text) {
      const message = document.createElement('div');
      message.textContent = text;
      message.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 10000;
        animation: fadeIn 0.3s;
      \`;
      document.body.appendChild(message);
      setTimeout(() => {
        message.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }
    
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeOut { from { opacity: 1; transform: translateY(-20px); } to { opacity: 0; transform: translateY(0); } }
    \`;
    document.head.appendChild(style);
  });
  </script>
</body>
</html>`;
    }

    async getAccessToken() {
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: BLOGGER_CONFIG.clientId,
                client_secret: BLOGGER_CONFIG.clientSecret,
                refresh_token: BLOGGER_CONFIG.refreshToken,
                grant_type: 'refresh_token'
            });
            
            return response.data.access_token;
        } catch (error) {
            console.error('❌ فشل الحصول على access token:', error.response?.data || error.message);
            throw error;
        }
    }

    async publishToBlogger(episode) {
        console.log(`📝 نشر: ${episode.title} على بلوجر...`);
        
        try {
            const accessToken = await this.getAccessToken();
            const postContent = this.generatePostHtml(episode);
            
            const postData = {
                kind: 'blogger#post',
                title: `🎬 ${episode.title} - حلقة رمضان 2026`,
                content: postContent,
                labels: ['مسلسلات رمضان 2026', 'لاروزا', 'حلقة جديدة', `اليوم ${this.state.totalPublished + 1}`]
            };

            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                postData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ تم النشر بنجاح: ${response.data.url}`);
            
            await this.saveLocalBackup(episode, response.data.url);
            
            return { 
                success: true, 
                url: response.data.url,
                postId: response.data.id
            };
            
        } catch (error) {
            console.error('❌ فشل النشر على بلوجر:', error.response?.data || error.message);
            
            const backupFile = await this.saveLocalBackup(episode);
            console.log(`💾 تم حفظ نسخة احتياطية محلية: ${backupFile}`);
            
            return { 
                success: false, 
                error: error.message,
                backupFile 
            };
        }
    }

    async saveLocalBackup(episode, publishedUrl = null) {
        await fs.ensureDir(SETTINGS.postsDir);
        
        const date = new Date().toISOString().split('T')[0];
        const fileName = `${SETTINGS.postsDir}/${date}_${episode.id}.html`;
        
        let content = this.generatePostHtml(episode);
        if (publishedUrl) {
            content = content.replace('</body>', 
                `<div style="text-align:center; color:green; padding:10px;">✅ تم النشر: <a href="${publishedUrl}">${publishedUrl}</a></div>\n</body>`);
        }
        
        await fs.writeFile(fileName, content);
        return fileName;
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 بدء نظام النشر التلقائي - رمضان 2026');
        console.log('='.repeat(60));
        
        try {
            // استخراج جميع الحلقات
            const allEpisodes = await this.getAllEpisodes();
            
            if (allEpisodes.length === 0) {
                throw new Error('لم يتم العثور على حلقات');
            }

            // تصفية الحلقات غير المنشورة
            const unpublished = allEpisodes.filter(ep => 
                !this.state.published.includes(ep.link)
            );

            console.log(`📊 الحلقات المنشورة سابقاً: ${this.state.published.length}`);
            console.log(`📊 الحلقات الجديدة (غير المنشورة): ${unpublished.length}`);

            if (unpublished.length === 0) {
                console.log('🎉 لا توجد حلقات جديدة!');
                return;
            }

            // ✅ نشر جميع الحلقات الجديدة
            console.log(`\n📢 سيتم نشر ${unpublished.length} حلقة جديدة في هذه الجولة`);

            let publishedCount = 0;
            let failedCount = 0;
            const publishedLinks = [];

            // حلقة تكرار لنشر جميع الحلقات الجديدة
            for (let i = 0; i < unpublished.length; i++) {
                const episode = unpublished[i];
                console.log(`\n${'='.repeat(40)}`);
                console.log(`🎯 نشر الحلقة ${i + 1} من ${unpublished.length}:`);
                console.log(`   العنوان: ${episode.title}`);
                console.log(`   الرابط: ${episode.link}`);

                console.log('\n🔍 جاري استخراج السيرفرات...');
                episode.servers = await this.getEpisodeServers(episode.link);
                console.log(`✅ تم استخراج ${episode.servers.length} سيرفر`);

                console.log('\n📤 جاري النشر على بلوجر...');
                const result = await this.publishToBlogger(episode);

                if (result.success) {
                    publishedCount++;
                    publishedLinks.push(episode.link);
                    
                    console.log('\n' + '-'.repeat(40));
                    console.log(`✅✅✅ تم نشر الحلقة ${i + 1} بنجاح! ✅✅✅`);
                    console.log(`📌 عنوان الحلقة: ${episode.title}`);
                    console.log(`🔗 رابط المقال: ${result.url}`);
                    console.log('-'.repeat(40));
                } else {
                    failedCount++;
                    console.log(`\n⚠️ فشل نشر الحلقة ${i + 1} وتم حفظها محلياً`);
                }

                // انتظار 5 ثوان بين كل حلقة (حتى لا يتم حظرك)
                if (i < unpublished.length - 1) {
                    console.log('\n⏳ انتظار 5 ثوان قبل نشر الحلقة التالية...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // تحديث الحالة بعد نشر جميع الحلقات
            this.state.published = [...this.state.published, ...publishedLinks];
            this.state.lastDate = new Date().toISOString();
            this.state.index = this.state.published.length;
            this.state.totalPublished = this.state.published.length;
            this.saveState();

            console.log('\n' + '='.repeat(60));
            console.log('📊 تقرير النشر النهائي:');
            console.log('='.repeat(60));
            console.log(`✅ تم النشر بنجاح: ${publishedCount} حلقات`);
            console.log(`❌ فشل النشر: ${failedCount} حلقات`);
            console.log(`📊 إجمالي المنشورات الكلي: ${this.state.totalPublished}`);
            console.log('='.repeat(60));

            // عرض روابط المنشورات إذا أردت
            if (publishedCount > 0) {
                console.log('\n📋 تم نشر الحلقات التالية:');
                unpublished.forEach((ep, index) => {
                    if (index < publishedCount) {
                        console.log(`   ${index + 1}. ${ep.title}`);
                    }
                });
            }

        } catch (error) {
            console.error('\n❌ خطأ في التشغيل:', error.message);
        }
    }
}

// ===== تشغيل التطبيق =====
console.log('📢 بدء تشغيل مستخرج حلقات رمضان 2026');
new AutoPublisher().run();
