import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== إعدادات ====================
const BASE_URL = "https://topcinema.rip";
const CATEGORY_URL = `${BASE_URL}/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/`;

// مجلدات الملفات
const SERIES_DIR = path.join(__dirname, "series");
const SEASONS_DIR = path.join(__dirname, "seasons");
const EPISODES_DIR = path.join(__dirname, "episodes");

// ملفات الفهرس
const SERIES_INDEX = path.join(SERIES_DIR, "index.json");
const SEASONS_INDEX = path.join(SEASONS_DIR, "index.json");
const EPISODES_INDEX = path.join(EPISODES_DIR, "index.json");
const PROGRESS_FILE = path.join(__dirname, "progress.json");

// إنشاء المجلدات
[SERIES_DIR, SEASONS_DIR, EPISODES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== نظام التقدم ====================
class ProgressTracker {
    constructor() {
        this.loadProgress();
    }
    
    loadProgress() {
        try {
            if (fs.existsSync(PROGRESS_FILE)) {
                const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
                this.seriesPage = data.seriesPage || 1;
                this.currentSeriesIndex = data.currentSeriesIndex || 0;
                this.currentSeasonIndex = data.currentSeasonIndex || 0;
                this.currentEpisodeIndex = data.currentEpisodeIndex || 0;
                this.mode = data.mode || "series"; // series, seasons, episodes
            } else {
                this.seriesPage = 1;
                this.currentSeriesIndex = 0;
                this.currentSeasonIndex = 0;
                this.currentEpisodeIndex = 0;
                this.mode = "series";
            }
        } catch (error) {
            this.seriesPage = 1;
            this.currentSeriesIndex = 0;
            this.currentSeasonIndex = 0;
            this.currentEpisodeIndex = 0;
            this.mode = "series";
        }
    }
    
    saveProgress() {
        try {
            const progressData = {
                seriesPage: this.seriesPage,
                currentSeriesIndex: this.currentSeriesIndex,
                currentSeasonIndex: this.currentSeasonIndex,
                currentEpisodeIndex: this.currentEpisodeIndex,
                mode: this.mode,
                lastUpdate: new Date().toISOString()
            };
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
        } catch (error) {
            console.log("❌ خطأ في حفظ التقدم");
        }
    }
    
    nextSeriesPage() {
        this.seriesPage++;
        this.currentSeriesIndex = 0;
        this.saveProgress();
    }
    
    setMode(mode) {
        this.mode = mode;
        this.saveProgress();
    }
}

// ==================== دوال المساعدة ====================
async function fetchWithTimeout(url, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        return await response.text();
        
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}

function extractId(url) {
    try {
        // استخراج ID من رابط المختصر ?gt=xxxx أو ?p=xxxx
        const gtMatch = url.match(/[?&]gt=(\d+)/);
        const pMatch = url.match(/[?&]p=(\d+)/);
        
        if (gtMatch && gtMatch[1]) return `gt_${gtMatch[1]}`;
        if (pMatch && pMatch[1]) return `p_${pMatch[1]}`;
        
        // استخراج من الرابط
        const parts = url.split('/').filter(p => p);
        const lastPart = parts[parts.length - 1];
        const numMatch = lastPart.match(/(\d+)/);
        return numMatch ? `url_${numMatch[1]}` : `hash_${Date.now()}`;
    } catch {
        return `error_${Date.now()}`;
    }
}

function cleanText(text) {
    return text ? text.replace(/\s+/g, " ").trim() : "";
}

function getFileName(pageNum) {
    return pageNum === 1 ? "Home.json" : `${pageNum}.json`;
}

function savePageFile(dir, pageNum, data) {
    const fileName = getFileName(pageNum);
    const filePath = path.join(dir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 ${fileName} (${data.items?.length || 0} عنصر)`);
    return fileName;
}

// ==================== استخراج المسلسلات من صفحة ====================
async function fetchSeriesPage(pageNum) {
    const url = pageNum === 1 ? CATEGORY_URL : `${CATEGORY_URL}page/${pageNum}/`;
    
    console.log(`\n📺 صفحة المسلسلات ${pageNum}: ${url}`);
    
    const html = await fetchWithTimeout(url);
    if (!html) {
        console.log("❌ فشل جلب صفحة المسلسلات");
        return null;
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const seriesList = [];
        
        // البحث عن عناصر المسلسلات
        const seriesElements = doc.querySelectorAll('.Small--Box a.recent--block');
        console.log(`✅ وجدت ${seriesElements.length} مسلسل في الصفحة`);
        
        for (let i = 0; i < seriesElements.length; i++) {
            const element = seriesElements[i];
            const seriesUrl = element.href;
            
            if (!seriesUrl.includes(BASE_URL)) continue;
            
            // استخراج البيانات الأساسية من العنصر
            const titleElement = element.querySelector('.title');
            const title = titleElement ? cleanText(titleElement.textContent) : `مسلسل ${i + 1}`;
            
            // استخراج عدد المواسم
            const seasonCountElement = element.querySelector('.number.Collection span');
            let seasonCount = 1;
            if (seasonCountElement) {
                const match = seasonCountElement.textContent.match(/(\d+)/);
                seasonCount = match ? parseInt(match[1]) : 1;
            }
            
            // استخراج التصنيفات
            const genres = [];
            const genreElements = element.querySelectorAll('.liList li:not(.imdbRating)');
            genreElements.forEach(li => {
                const genre = li.textContent.trim();
                if (genre && !genre.includes('p') && !genre.includes('WEB')) {
                    genres.push(genre);
                }
            });
            
            // استخراج الجودة
            let quality = "";
            const qualityElements = element.querySelectorAll('.liList li');
            qualityElements.forEach(li => {
                if (li.textContent.includes('p') || li.textContent.includes('WEB')) {
                    quality = li.textContent.trim();
                }
            });
            
            // استخراج تقييم IMDB
            const imdbElement = element.querySelector('.imdbRating');
            let imdbRating = "";
            if (imdbElement) {
                imdbRating = cleanText(imdbElement.textContent.replace(/IMDb/gi, ''));
            }
            
            // استخراج الصورة المصغرة
            const imageElement = element.querySelector('.Poster img');
            const thumbnail = imageElement ? imageElement.src : "";
            
            const seriesId = extractId(seriesUrl);
            
            seriesList.push({
                id: seriesId,
                title: title,
                url: seriesUrl,
                thumbnail: thumbnail,
                seasonCount: seasonCount,
                genres: genres,
                quality: quality,
                imdbRating: imdbRating,
                page: pageNum,
                position: i + 1,
                scrapedAt: new Date().toISOString()
            });
            
            // تأخير بين المسلسلات
            if (i < seriesElements.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return {
            page: pageNum,
            url: url,
            totalSeries: seriesList.length,
            scrapedAt: new Date().toISOString(),
            series: seriesList
        };
        
    } catch (error) {
        console.log(`❌ خطأ في استخراج صفحة المسلسلات: ${error.message}`);
        return null;
    }
}

// ==================== استخراج تفاصيل المسلسل الكاملة ====================
async function fetchSeriesDetails(series) {
    console.log(`🔍 جلب تفاصيل: ${series.title.substring(0, 30)}...`);
    
    const html = await fetchWithTimeout(series.url);
    if (!html) {
        console.log("   ⚠️ فشل جلب صفحة المسلسل");
        return null;
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // 1. استخراج ID من الرابط المختصر
        const shortLinkInput = doc.querySelector('#shortlink');
        const shortLink = shortLinkInput ? shortLinkInput.value : series.url;
        const seriesId = extractId(shortLink);
        
        // 2. البيانات الأساسية
        const title = doc.querySelector(".post-title a")?.textContent?.trim() || series.title;
        const image = doc.querySelector(".image img")?.src || series.thumbnail;
        const imdbRating = doc.querySelector(".imdbR span")?.textContent?.trim() || series.imdbRating;
        const story = doc.querySelector(".story p")?.textContent?.trim() || "غير متوفر";
        
        // 3. التفاصيل
        const details = {
            category: [],
            genres: [],
            quality: [],
            country: [],
            releaseYear: [],
            language: [],
            directors: [],
            actors: []
        };
        
        const detailItems = doc.querySelectorAll(".RightTaxContent li");
        
        detailItems.forEach(item => {
            const labelElement = item.querySelector("span");
            if (labelElement) {
                const label = labelElement.textContent.replace(":", "").trim();
                const links = item.querySelectorAll("a");
                
                if (links.length > 0) {
                    const values = Array.from(links).map(a => a.textContent.trim());
                    
                    if (label.includes("قسم")) {
                        details.category = values;
                    } else if (label.includes("نوع")) {
                        details.genres = values;
                    } else if (label.includes("جودة")) {
                        details.quality = values;
                    } else if (label.includes("البلد") || label.includes("دولة")) {
                        details.country = values;
                    } else if (label.includes("سنة") || label.includes("موعد")) {
                        details.releaseYear = values;
                    } else if (label.includes("لغة")) {
                        details.language = values;
                    } else if (label.includes("المخرجين")) {
                        details.directors = values;
                    } else if (label.includes("بطولة")) {
                        details.actors = values;
                    }
                }
            }
        });
        
        // 4. رابط صفحة المواسم
        const seasonsPageButton = doc.querySelector('a.watch[href*="/list/"]');
        const seasonsPageUrl = seasonsPageButton ? seasonsPageButton.href : null;
        
        return {
            id: seriesId,
            title: title,
            url: series.url,
            shortLink: shortLink,
            image: image,
            imdbRating: imdbRating,
            story: story,
            details: details,
            seasonsPage: seasonsPageUrl,
            page: series.page,
            position: series.position,
            scrapedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.log(`   ❌ خطأ: ${error.message}`);
        return null;
    }
}

// ==================== استخراج المواسم من صفحة المسلسل ====================
async function fetchSeasonsForSeries(seriesDetails) {
    if (!seriesDetails.seasonsPage) {
        console.log(`   ⚠️ لا توجد صفحة مواسم`);
        return [];
    }
    
    console.log(`   📚 جلب المواسم...`);
    
    const html = await fetchWithTimeout(seriesDetails.seasonsPage);
    if (!html) {
        console.log(`   ⚠️ فشل جلب صفحة المواسم`);
        return [];
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const seasonsList = [];
        
        // البحث عن عناصر المواسم
        const seasonElements = doc.querySelectorAll('.Small--Box.Season a');
        console.log(`   ✅ وجدت ${seasonElements.length} موسم`);
        
        for (let i = 0; i < seasonElements.length; i++) {
            const element = seasonElements[i];
            const seasonUrl = element.href;
            
            // استخراج رقم الموسم
            const seasonNumElement = element.querySelector('.epnum span + *');
            let seasonNum = 1;
            if (seasonNumElement) {
                const match = seasonNumElement.textContent.match(/(\d+)/);
                seasonNum = match ? parseInt(match[1]) : i + 1;
            }
            
            // عنوان الموسم
            const titleElement = element.querySelector('.title');
            const title = titleElement ? cleanText(titleElement.textContent) : `الموسم ${seasonNum}`;
            
            // الصورة
            const imageElement = element.querySelector('.Poster img');
            const image = imageElement ? imageElement.src : "";
            
            const seasonId = extractId(seasonUrl);
            
            seasonsList.push({
                id: seasonId,
                seriesId: seriesDetails.id,
                seriesTitle: seriesDetails.title,
                season: seasonNum,
                title: title,
                url: seasonUrl,
                image: image,
                scrapedAt: new Date().toISOString()
            });
            
            // تأخير بين المواسم
            if (i < seasonElements.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return seasonsList;
        
    } catch (error) {
        console.log(`   ❌ خطأ في المواسم: ${error.message}`);
        return [];
    }
}

// ==================== استخراج الحلقات من صفحة الموسم ====================
async function fetchEpisodesForSeason(season) {
    console.log(`   🎬 جلب حلقات الموسم ${season.season}...`);
    
    // أولاً: البحث عن رابط الحلقات في صفحة الموسم
    const html = await fetchWithTimeout(season.url);
    if (!html) {
        console.log(`   ⚠️ فشل جلب صفحة الموسم`);
        return [];
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // البحث عن زر "عرض جميع الحلقات"
        const episodesPageButton = doc.querySelector('a.watch[href*="/list/"]');
        const episodesPageUrl = episodesPageButton ? episodesPageButton.href : null;
        
        if (!episodesPageUrl) {
            console.log(`   ⚠️ لا توجد صفحة حلقات`);
            return [];
        }
        
        // جلب صفحة الحلقات
        const episodesHtml = await fetchWithTimeout(episodesPageUrl);
        if (!episodesHtml) {
            console.log(`   ⚠️ فشل جلب صفحة الحلقات`);
            return [];
        }
        
        const episodesDom = new JSDOM(episodesHtml);
        const episodesDoc = episodesDom.window.document;
        
        // استخراج الحلقات
        const episodeElements = episodesDoc.querySelectorAll('.Small--Box a.recent--block');
        console.log(`   ✅ وجدت ${episodeElements.length} حلقة`);
        
        const episodesList = [];
        
        for (let i = 0; i < episodeElements.length; i++) {
            const element = episodeElements[i];
            const episodeUrl = element.href;
            
            // استخراج رقم الحلقة
            const episodeNumElement = element.querySelector('.number span + *');
            let episodeNum = i + 1;
            if (episodeNumElement) {
                const match = episodeNumElement.textContent.match(/(\d+)/);
                episodeNum = match ? parseInt(match[1]) : i + 1;
            }
            
            // عنوان الحلقة
            const titleElement = element.querySelector('.title');
            const title = titleElement ? cleanText(titleElement.textContent) : `الحلقة ${episodeNum}`;
            
            const episodeId = extractId(episodeUrl);
            
            episodesList.push({
                id: episodeId,
                seriesId: season.seriesId,
                seriesTitle: season.seriesTitle,
                seasonId: season.id,
                seasonNumber: season.season,
                episode: episodeNum,
                title: title,
                url: episodeUrl,
                scrapedAt: new Date().toISOString()
            });
            
            // تأخير بين الحلقات
            if (i < episodeElements.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        return episodesList;
        
    } catch (error) {
        console.log(`   ❌ خطأ في الحلقات: ${error.message}`);
        return [];
    }
}

// ==================== استخراج سيرفرات الحلقة ====================
async function fetchEpisodeServers(episode) {
    console.log(`     📥 جلب سيرفرات الحلقة ${episode.episode}...`);
    
    // جلب صفحة الحلقة
    const html = await fetchWithTimeout(episode.url);
    if (!html) return { watchServers: [], downloadServers: [] };
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // البحث عن أزرار المشاهدة والتحميل
        const watchButton = doc.querySelector('a.watch[href*="/watch/"]');
        const downloadButton = doc.querySelector('a.download[href*="/download/"]');
        
        const servers = {
            watchServers: [],
            downloadServers: []
        };
        
        // استخراج سيرفرات المشاهدة
        if (watchButton && watchButton.href) {
            const watchHtml = await fetchWithTimeout(watchButton.href);
            if (watchHtml) {
                const watchDom = new JSDOM(watchHtml);
                const watchDoc = watchDom.window.document;
                
                // استخراج رابط الفيديو من meta tag
                const videoMeta = watchDoc.querySelector('meta[property="og:video:secure_url"]');
                if (videoMeta && videoMeta.content) {
                    servers.watchServers.push({
                        type: "embed",
                        url: videoMeta.content,
                        quality: "متعدد الجودات",
                        scrapedAt: new Date().toISOString()
                    });
                }
            }
        }
        
        // استخراج سيرفرات التحميل
        if (downloadButton && downloadButton.href) {
            const downloadHtml = await fetchWithTimeout(downloadButton.href);
            if (downloadHtml) {
                const downloadDom = new JSDOM(downloadHtml);
                const downloadDoc = downloadDom.window.document;
                
                // سيرفرات التحميل الرئيسية
                const proServerLinks = downloadDoc.querySelectorAll('.proServer a.downloadsLink');
                proServerLinks.forEach(link => {
                    if (link.href) {
                        servers.downloadServers.push({
                            server: link.querySelector('p')?.textContent?.trim() || "غير معروف",
                            url: link.href,
                            quality: "متعدد الجودات",
                            type: "pro"
                        });
                    }
                });
                
                // سيرفرات التحميل العادية
                const downloadBlocks = downloadDoc.querySelectorAll('.DownloadBlock');
                downloadBlocks.forEach(block => {
                    const quality = block.querySelector('span')?.textContent?.trim() || "غير معروف";
                    const serverLinks = block.querySelectorAll('a.downloadsLink');
                    
                    serverLinks.forEach(link => {
                        if (link.href) {
                            servers.downloadServers.push({
                                server: link.querySelector('span')?.textContent?.trim() || "غير معروف",
                                url: link.href,
                                quality: quality,
                                type: "normal"
                            });
                        }
                    });
                });
            }
        }
        
        return servers;
        
    } catch (error) {
        console.log(`     ⚠️ خطأ في سيرفرات: ${error.message}`);
        return { watchServers: [], downloadServers: [] };
    }
}

// ==================== الدالة الرئيسية ====================
async function main() {
    console.log("🚀 بدء استخراج المسلسلات");
    console.log("=".repeat(50));
    
    const progress = new ProgressTracker();
    
    let totalSeries = 0;
    let totalSeasons = 0;
    let totalEpisodes = 0;
    let consecutiveDuplicates = 0;
    
    // ==================== مرحلة 1: استخراج المسلسلات ====================
    console.log("\n📺 ===== مرحلة المسلسلات =====");
    
    while (true) {
        const pageNum = progress.seriesPage;
        console.log(`\n📄 الصفحة ${pageNum}`);
        
        // جلب صفحة المسلسلات
        const seriesPage = await fetchSeriesPage(pageNum);
        
        if (!seriesPage || seriesPage.series.length === 0) {
            console.log("⏹️ توقف: لا توجد مسلسلات");
            break;
        }
        
        // استخراج تفاصيل كل مسلسل
        const allSeriesDetails = [];
        
        for (let i = 0; i < seriesPage.series.length; i++) {
            const series = seriesPage.series[i];
            console.log(`\n${i + 1}/${seriesPage.series.length}: ${series.title}`);
            
            const seriesDetails = await fetchSeriesDetails(series);
            
            if (seriesDetails) {
                allSeriesDetails.push(seriesDetails);
                totalSeries++;
            }
            
            // تأخير بين المسلسلات
            if (i < seriesPage.series.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // حفظ صفحة المسلسلات في ملف
        if (allSeriesDetails.length > 0) {
            const pageData = {
                ...seriesPage,
                series: allSeriesDetails
            };
            savePageFile(SERIES_DIR, pageNum, pageData);
        }
        
        console.log(`\n✅ صفحة ${pageNum}: ${allSeriesDetails.length} مسلسل`);
        
        // التحقق إذا كانت هناك صفحة تالية
        if (seriesPage.series.length < 20) { // افتراض 20 مسلسل لكل صفحة
            console.log("⏹️ توقف: آخر صفحة");
            break;
        }
        
        // الانتقال للصفحة التالية
        progress.nextSeriesPage();
        
        // تأخير بين الصفحات
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // ==================== مرحلة 2: استخراج المواسم ====================
    console.log("\n📚 ===== مرحلة المواسم =====");
    
    // قراءة كل ملفات المسلسلات
    const seriesFiles = fs.readdirSync(SERIES_DIR)
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .sort((a, b) => {
            if (a === 'Home.json') return -1;
            if (b === 'Home.json') return 1;
            return parseInt(a) - parseInt(b);
        });
    
    for (const seriesFile of seriesFiles) {
        const filePath = path.join(SERIES_DIR, seriesFile);
        const seriesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`\n📄 معالجة: ${seriesFile} (${seriesData.series.length} مسلسل)`);
        
        const allSeasons = [];
        
        for (const series of seriesData.series) {
            console.log(`  🔍 ${series.title.substring(0, 30)}...`);
            
            const seasons = await fetchSeasonsForSeries(series);
            
            if (seasons.length > 0) {
                allSeasons.push(...seasons);
                totalSeasons += seasons.length;
            }
            
            // تأخير بين المسلسلات
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // حفظ صفحة المواسم
        if (allSeasons.length > 0) {
            const pageNum = seriesFile === 'Home.json' ? 1 : parseInt(seriesFile);
            const seasonsPageData = {
                page: pageNum,
                sourceFile: seriesFile,
                totalSeasons: allSeasons.length,
                scrapedAt: new Date().toISOString(),
                seasons: allSeasons
            };
            
            savePageFile(SEASONS_DIR, pageNum, seasonsPageData);
        }
        
        // تأخير بين الملفات
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // ==================== مرحلة 3: استخراج الحلقات ====================
    console.log("\n🎬 ===== مرحلة الحلقات =====");
    
    // قراءة كل ملفات المواسم
    const seasonsFiles = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .sort((a, b) => {
            if (a === 'Home.json') return -1;
            if (b === 'Home.json') return 1;
            return parseInt(a) - parseInt(b);
        });
    
    for (const seasonsFile of seasonsFiles) {
        const filePath = path.join(SEASONS_DIR, seasonsFile);
        const seasonsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`\n📄 معالجة: ${seasonsFile} (${seasonsData.seasons.length} موسم)`);
        
        const allEpisodes = [];
        
        for (const season of seasonsData.seasons) {
            console.log(`  📚 ${season.seriesTitle.substring(0, 20)} - الموسم ${season.season}`);
            
            const episodes = await fetchEpisodesForSeason(season);
            
            if (episodes.length > 0) {
                // استخراج سيرفرات لكل حلقة
                for (const episode of episodes) {
                    const servers = await fetchEpisodeServers(episode);
                    episode.servers = servers;
                    allEpisodes.push(episode);
                    totalEpisodes++;
                    
                    // تأخير بين الحلقات
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            // تأخير بين المواسم
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // حفظ صفحة الحلقات
        if (allEpisodes.length > 0) {
            const pageNum = seasonsFile === 'Home.json' ? 1 : parseInt(seasonsFile);
            const episodesPageData = {
                page: pageNum,
                sourceFile: seasonsFile,
                totalEpisodes: allEpisodes.length,
                scrapedAt: new Date().toISOString(),
                episodes: allEpisodes
            };
            
            savePageFile(EPISODES_DIR, pageNum, episodesPageData);
        }
        
        // تأخير بين الملفات
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // ==================== النتائج ====================
    console.log("\n" + "=".repeat(50));
    console.log("🎉 انتهى الاستخراج!");
    console.log("=".repeat(50));
    console.log(`📊 النتائج:`);
    console.log(`   📺 المسلسلات: ${totalSeries}`);
    console.log(`   📚 المواسم: ${totalSeasons}`);
    console.log(`   🎬 الحلقات: ${totalEpisodes}`);
    console.log("=".repeat(50));
    
    // حفظ التقرير
    const report = {
        status: "completed",
        totalSeries: totalSeries,
        totalSeasons: totalSeasons,
        totalEpisodes: totalEpisodes,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync("report.json", JSON.stringify(report, null, 2));
    console.log("📄 التقرير: report.json");
}

// ==================== التشغيل ====================
main().catch(error => {
    console.error("💥 خطأ:", error.message);
    
    const errorReport = {
        error: error.message,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync("error.json", JSON.stringify(errorReport, null, 2));
});
