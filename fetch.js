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

// إنشاء المجلدات
[SERIES_DIR, SEASONS_DIR, EPISODES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
        if (!response.ok) {
            console.log(`❌ فشل الجلب: ${response.status}`);
            return null;
        }
        return await response.text();
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.log(`❌ خطأ في fetch: ${error.message}`);
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

// ==================== استخراج المسلسلات من الصفحة الأولى ====================
async function fetchSeriesPage() {
    console.log(`📺 جلب الصفحة الأولى: ${CATEGORY_URL}`);
    
    const html = await fetchWithTimeout(CATEGORY_URL);
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
        console.log(`✅ وجدت ${seriesElements.length} مسلسل في الصفحة الأولى`);
        
        // نأخذ أول 3 مسلسلات فقط للتجربة
        const testLimit = Math.min(3, seriesElements.length);
        
        for (let i = 0; i < testLimit; i++) {
            const element = seriesElements[i];
            const seriesUrl = element.href;
            
            if (!seriesUrl.includes(BASE_URL)) continue;
            
            // استخراج البيانات الأساسية من العنصر
            const titleElement = element.querySelector('.title');
            const title = titleElement ? cleanText(titleElement.textContent) : `مسلسل ${i + 1}`;
            
            console.log(`\n🎬 [${i + 1}/${testLimit}] ${title}`);
            
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
            
            // جلب تفاصيل المسلسل الكاملة
            const seriesDetails = await fetchSeriesDetails({
                title: title,
                url: seriesUrl,
                thumbnail: thumbnail,
                imdbRating: imdbRating
            });
            
            if (seriesDetails) {
                seriesList.push({
                    id: seriesId,
                    title: title,
                    url: seriesUrl,
                    thumbnail: thumbnail,
                    seasonCount: seasonCount,
                    genres: genres,
                    quality: quality,
                    imdbRating: imdbRating,
                    page: 1,
                    position: i + 1,
                    scrapedAt: new Date().toISOString(),
                    details: seriesDetails
                });
            }
            
            // تأخير بين المسلسلات
            if (i < testLimit - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return {
            page: 1,
            url: CATEGORY_URL,
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
    console.log(`  🔍 جلب تفاصيل المسلسل...`);
    
    const html = await fetchWithTimeout(series.url);
    if (!html) {
        console.log("  ⚠️ فشل جلب صفحة المسلسل");
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
            image: image,
            imdbRating: imdbRating,
            story: story,
            details: details,
            seasonsPage: seasonsPageUrl,
            shortLink: shortLink
        };
        
    } catch (error) {
        console.log(`  ❌ خطأ: ${error.message}`);
        return null;
    }
}

// ==================== استخراج المواسم للمسلسل ====================
async function fetchSeasonsForSeries(seriesDetails) {
    if (!seriesDetails.seasonsPage) {
        console.log(`  ⚠️ لا توجد صفحة مواسم`);
        return [];
    }
    
    console.log(`  📚 جلب المواسم...`);
    
    const html = await fetchWithTimeout(seriesDetails.seasonsPage);
    if (!html) {
        console.log(`  ⚠️ فشل جلب صفحة المواسم`);
        return [];
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const seasonsList = [];
        
        // البحث عن عناصر المواسم
        const seasonElements = doc.querySelectorAll('.Small--Box.Season a');
        console.log(`  ✅ وجدت ${seasonElements.length} موسم`);
        
        // نأخذ أول 2 موسم فقط للتجربة
        const testLimit = Math.min(2, seasonElements.length);
        
        for (let i = 0; i < testLimit; i++) {
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
            
            console.log(`    📖 الموسم ${seasonNum}: ${title}`);
            
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
            if (i < testLimit - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return seasonsList;
        
    } catch (error) {
        console.log(`  ❌ خطأ في المواسم: ${error.message}`);
        return [];
    }
}

// ==================== استخراج الحلقات للموسم ====================
async function fetchEpisodesForSeason(season) {
    console.log(`    🎬 جلب حلقات الموسم ${season.season}...`);
    
    // أولاً: البحث عن رابط الحلقات في صفحة الموسم
    const html = await fetchWithTimeout(season.url);
    if (!html) {
        console.log(`    ⚠️ فشل جلب صفحة الموسم`);
        return [];
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // البحث عن زر "عرض جميع الحلقات"
        const episodesPageButton = doc.querySelector('a.watch[href*="/list/"]');
        const episodesPageUrl = episodesPageButton ? episodesPageButton.href : null;
        
        if (!episodesPageUrl) {
            console.log(`    ⚠️ لا توجد صفحة حلقات`);
            return [];
        }
        
        // جلب صفحة الحلقات
        const episodesHtml = await fetchWithTimeout(episodesPageUrl);
        if (!episodesHtml) {
            console.log(`    ⚠️ فشل جلب صفحة الحلقات`);
            return [];
        }
        
        const episodesDom = new JSDOM(episodesHtml);
        const episodesDoc = episodesDom.window.document;
        
        // استخراج الحلقات
        const episodeElements = episodesDoc.querySelectorAll('.Small--Box a.recent--block');
        console.log(`    ✅ وجدت ${episodeElements.length} حلقة`);
        
        const episodesList = [];
        
        // نأخذ أول 2 حلقة فقط للتجربة
        const testLimit = Math.min(2, episodeElements.length);
        
        for (let i = 0; i < testLimit; i++) {
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
            
            console.log(`      📝 الحلقة ${episodeNum}: ${title.substring(0, 30)}...`);
            
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
            if (i < testLimit - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        return episodesList;
        
    } catch (error) {
        console.log(`    ❌ خطأ في الحلقات: ${error.message}`);
        return [];
    }
}

// ==================== استخراج سيرفرات الحلقة ====================
async function fetchEpisodeServers(episode) {
    console.log(`      📥 جلب سيرفرات الحلقة ${episode.episode}...`);
    
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
        console.log(`      ⚠️ خطأ في سيرفرات: ${error.message}`);
        return { watchServers: [], downloadServers: [] };
    }
}

// ==================== حفظ الملفات ====================
function saveFile(dir, fileName, data) {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 ${fileName} (${data.items?.length || data.series?.length || data.seasons?.length || data.episodes?.length || 0} عنصر)`);
    return fileName;
}

// ==================== الدالة الرئيسية ====================
async function main() {
    console.log("🚀 بدء استخراج الصفحة الأولى للمسلسلات (للاختبار)");
    console.log("=".repeat(50));
    
    const startTime = Date.now();
    
    try {
        // ==================== مرحلة 1: استخراج المسلسلات ====================
        console.log("\n📺 ===== مرحلة المسلسلات =====");
        
        const seriesPage = await fetchSeriesPage();
        
        if (!seriesPage || seriesPage.series.length === 0) {
            console.log("❌ لم يتم العثور على مسلسلات");
            return;
        }
        
        // حفظ ملف المسلسلات
        saveFile(SERIES_DIR, "Home.json", seriesPage);
        
        console.log(`\n✅ تم استخراج ${seriesPage.series.length} مسلسل`);
        
        // ==================== مرحلة 2: استخراج المواسم ====================
        console.log("\n📚 ===== مرحلة المواسم =====");
        
        const allSeasons = [];
        
        for (const series of seriesPage.series) {
            if (series.details) {
                const seasons = await fetchSeasonsForSeries(series.details);
                if (seasons.length > 0) {
                    allSeasons.push(...seasons);
                }
                
                // تأخير بين المسلسلات
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // حفظ ملف المواسم
        if (allSeasons.length > 0) {
            const seasonsPage = {
                page: 1,
                totalSeasons: allSeasons.length,
                scrapedAt: new Date().toISOString(),
                seasons: allSeasons
            };
            
            saveFile(SEASONS_DIR, "Home.json", seasonsPage);
        }
        
        // ==================== مرحلة 3: استخراج الحلقات ====================
        console.log("\n🎬 ===== مرحلة الحلقات =====");
        
        const allEpisodes = [];
        
        for (const season of allSeasons) {
            const episodes = await fetchEpisodesForSeason(season);
            
            if (episodes.length > 0) {
                // استخراج سيرفرات لكل حلقة
                for (const episode of episodes) {
                    const servers = await fetchEpisodeServers(episode);
                    episode.servers = servers;
                    allEpisodes.push(episode);
                    
                    // تأخير بين الحلقات
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            // تأخير بين المواسم
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // حفظ ملف الحلقات
        if (allEpisodes.length > 0) {
            const episodesPage = {
                page: 1,
                totalEpisodes: allEpisodes.length,
                scrapedAt: new Date().toISOString(),
                episodes: allEpisodes
            };
            
            saveFile(EPISODES_DIR, "Home.json", episodesPage);
        }
        
        // ==================== النتائج ====================
        const executionTime = Date.now() - startTime;
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 انتهى الاختبار!");
        console.log("=".repeat(50));
        console.log(`📊 النتائج:`);
        console.log(`   📺 المسلسلات: ${seriesPage.series.length}`);
        console.log(`   📚 المواسم: ${allSeasons.length}`);
        console.log(`   🎬 الحلقات: ${allEpisodes.length}`);
        console.log(`   ⏱️ الوقت: ${(executionTime / 1000).toFixed(1)} ثانية`);
        console.log("=".repeat(50));
        
        // حفظ التقرير
        const report = {
            status: "test_completed",
            totalSeries: seriesPage.series.length,
            totalSeasons: allSeasons.length,
            totalEpisodes: allEpisodes.length,
            executionTime: executionTime,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync("report.json", JSON.stringify(report, null, 2));
        console.log("📄 التقرير: report.json");
        
    } catch (error) {
        console.error("💥 خطأ غير متوقع:", error.message);
        
        const errorReport = {
            error: error.message,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync("error.json", JSON.stringify(errorReport, null, 2));
    }
}

// ==================== التشغيل ====================
main();
