import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إعدادات المسارات
const SERIES_DIR = path.join(__dirname, "series");
const INDEX_FILE = path.join(SERIES_DIR, "index.json");
const PROGRESS_FILE = path.join(__dirname, "progress.json");

// إنشاء مجلد series إذا لم يكن موجوداً
if (!fs.existsSync(SERIES_DIR)) {
    fs.mkdirSync(SERIES_DIR, { recursive: true });
}

// ==================== نظام الفهرس ====================
class SeriesIndex {
    constructor() {
        this.loadIndex();
    }
    
    loadIndex() {
        try {
            if (fs.existsSync(INDEX_FILE)) {
                const data = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
                this.series = data.series || {};
                this.pages = data.pages || {};
                this.stats = data.stats || { totalSeries: 0, totalPages: 0 };
            } else {
                this.series = {};
                this.pages = {};
                this.stats = { totalSeries: 0, totalPages: 0 };
                this.saveIndex();
            }
        } catch (error) {
            this.series = {};
            this.pages = {};
            this.stats = { totalSeries: 0, totalPages: 0 };
        }
    }
    
    saveIndex() {
        try {
            const indexData = {
                series: this.series,
                pages: this.pages,
                stats: this.stats,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));
        } catch (error) {
            console.log("❌ خطأ في حفظ الفهرس");
        }
    }
    
    addSeries(seriesId, seriesData) {
        if (!this.series[seriesId]) {
            this.series[seriesId] = {
                id: seriesId,
                title: seriesData.title,
                episodes: seriesData.episodes || [],
                page: seriesData.page,
                firstSeen: new Date().toISOString()
            };
            return true;
        }
        return false;
    }
    
    isSeriesExists(seriesId) {
        return !!this.series[seriesId];
    }
}

// ==================== نظام التقدم ====================
class ProgressTracker {
    constructor() {
        this.loadProgress();
    }
    
    loadProgress() {
        try {
            if (fs.existsSync(PROGRESS_FILE)) {
                const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
                this.currentPage = data.currentPage || 1;
            } else {
                this.currentPage = 1;
            }
        } catch (error) {
            this.currentPage = 1;
        }
    }
    
    saveProgress() {
        try {
            const progressData = {
                currentPage: this.currentPage,
                lastUpdate: new Date().toISOString()
            };
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
        } catch (error) {
            console.log("❌ خطأ في حفظ التقدم");
        }
    }
    
    nextPage() {
        this.currentPage++;
        this.saveProgress();
    }
}

// ==================== fetch مع timeout ====================
async function fetchWithTimeout(url, timeout = 15000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return null;
        }
        
        return await response.text();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`⏱️ انتهى الوقت`);
        }
        return null;
    }
}

// ==================== استخراج ID من الرابط ====================
function extractSeriesId(url) {
    try {
        // استخراج ID من الرابط (مثال: /series/12345/)
        const match = url.match(/\/(\d+)\/?$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// ==================== استخراج المسلسلات من صفحة ====================
async function fetchSeriesFromPage(pageNum) {
    const url = pageNum === 1 
        ? "https://topcinema.rip/series/"
        : `https://topcinema.rip/series/page/${pageNum}/`;
    
    console.log(`📖 الصفحة ${pageNum === 1 ? "Home" : pageNum}`);
    
    const html = await fetchWithTimeout(url);
    
    if (!html) {
        console.log(`❌ فشل جلب الصفحة`);
        return null;
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const series = [];
        
        // البحث عن عناصر المسلسلات (عدل حسب هيكل الموقع)
        const seriesElements = doc.querySelectorAll('.post-item, .series-item, .show-item, article');
        
        console.log(`✅ ${seriesElements.length} مسلسل`);
        
        seriesElements.forEach((element, i) => {
            const titleElement = element.querySelector('h2, h3, .title, .entry-title');
            const linkElement = element.querySelector('a');
            
            if (linkElement && linkElement.href) {
                const title = titleElement?.textContent?.trim() || 
                             element.textContent?.trim() || 
                             `مسلسل ${i + 1}`;
                
                series.push({
                    title: title.substring(0, 100),
                    url: linkElement.href,
                    page: pageNum,
                    position: i + 1
                });
            }
        });
        
        return { url, series };
        
    } catch (error) {
        console.log(`❌ خطأ في تحليل الصفحة`);
        return null;
    }
}

// ==================== استخراج تفاصيل المسلسل ====================
async function fetchSeriesDetails(series) {
    console.log(`📺 ${series.title.substring(0, 30)}...`);
    
    const html = await fetchWithTimeout(series.url);
    
    if (!html) {
        console.log(`   ⚠️ فشل جلب صفحة المسلسل`);
        return null;
    }
    
    try {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        // 1. استخراج ID
        const seriesId = extractSeriesId(series.url);
        
        if (!seriesId) {
            console.log(`   ⚠️ لم يتم العثور على ID`);
            return null;
        }
        
        // 2. البيانات الأساسية
        const title = doc.querySelector(".post-title, h1.entry-title")?.textContent?.trim() || series.title;
        const image = doc.querySelector(".post-image img, .entry-content img")?.src;
        
        // 3. القصة
        const story = doc.querySelector(".story, .entry-content p")?.textContent?.trim() || "غير متوفر";
        
        // 4. استخراج المواسم والحلقات
        const seasons = [];
        
        // البحث عن عناصر المواسم
        const seasonElements = doc.querySelectorAll('.season, .season-item');
        
        if (seasonElements.length > 0) {
            seasonElements.forEach((seasonEl, seasonIndex) => {
                const seasonTitle = seasonEl.querySelector('.season-title, h3')?.textContent?.trim() || `الموسم ${seasonIndex + 1}`;
                
                const episodes = [];
                const episodeElements = seasonEl.querySelectorAll('.episode, .episode-item');
                
                episodeElements.forEach((episodeEl, epIndex) => {
                    const episodeTitle = episodeEl.querySelector('.episode-title, h4')?.textContent?.trim() || `الحلقة ${epIndex + 1}`;
                    const episodeLink = episodeEl.querySelector('a')?.href;
                    
                    episodes.push({
                        title: episodeTitle,
                        url: episodeLink,
                        number: epIndex + 1
                    });
                });
                
                seasons.push({
                    title: seasonTitle,
                    number: seasonIndex + 1,
                    episodes: episodes
                });
            });
        } else {
            // إذا لم توجد مواسم، نبحث عن حلقات مباشرة
            const episodeElements = doc.querySelectorAll('.episode-list li, .episodes a');
            const episodes = [];
            
            episodeElements.forEach((episodeEl, index) => {
                const episodeTitle = episodeEl.textContent?.trim() || `الحلقة ${index + 1}`;
                const episodeLink = episodeEl.href || episodeEl.querySelector('a')?.href;
                
                episodes.push({
                    title: episodeTitle,
                    url: episodeLink,
                    number: index + 1
                });
            });
            
            if (episodes.length > 0) {
                seasons.push({
                    title: "الموسم الأول",
                    number: 1,
                    episodes: episodes
                });
            }
        }
        
        // 5. التفاصيل الأخرى
        const details = {};
        const detailItems = doc.querySelectorAll('.details li, .meta-data span');
        
        detailItems.forEach(item => {
            const text = item.textContent?.trim();
            if (text.includes(':')) {
                const [key, ...values] = text.split(':');
                details[key.trim()] = values.join(':').trim();
            }
        });
        
        return {
            id: seriesId,
            title: title,
            url: series.url,
            image: image,
            story: story,
            details: details,
            seasons: seasons,
            totalSeasons: seasons.length,
            totalEpisodes: seasons.reduce((sum, season) => sum + season.episodes.length, 0),
            page: series.page,
            position: series.position,
            scrapedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.log(`   ❌ خطأ: ${error.message}`);
        return null;
    }
}

// ==================== حفظ الصفحة ====================
function savePage(pageNum, pageData, seriesData) {
    const fileName = pageNum === 1 ? "Home.json" : `${pageNum}.json`;
    const filePath = path.join(SERIES_DIR, fileName);
    
    const pageContent = {
        page: pageNum,
        url: pageData.url,
        totalSeries: seriesData.length,
        scrapedAt: new Date().toISOString(),
        series: seriesData
    };
    
    fs.writeFileSync(filePath, JSON.stringify(pageContent, null, 2));
    console.log(`💾 ${fileName} (${seriesData.length} مسلسل)`);
    
    return fileName;
}

// ==================== الدالة الرئيسية ====================
async function main() {
    console.log("🚀 بدء استخراج المسلسلات");
    console.log("=".repeat(50));
    
    const index = new SeriesIndex();
    const progress = new ProgressTracker();
    
    let totalNew = 0;
    let consecutiveDuplicates = 0;
    const MAX_CONSECUTIVE_DUPLICATES = 3;
    
    while (true) {
        const pageNum = progress.currentPage;
        console.log(`\n📄 === صفحة ${pageNum === 1 ? "Home" : pageNum} ===`);
        
        // جلب الصفحة
        const pageData = await fetchSeriesFromPage(pageNum);
        
        if (!pageData || pageData.series.length === 0) {
            console.log("⏹️ توقف: لا توجد مسلسلات");
            break;
        }
        
        // استخراج التفاصيل
        const newSeries = [];
        let pageHasNew = false;
        
        for (const series of pageData.series) {
            // جلب التفاصيل
            const details = await fetchSeriesDetails(series);
            
            if (!details || !details.id) {
                console.log(`   ⚠️ تخطي: لم يتم استخراج ID`);
                continue;
            }
            
            // التحقق من التكرار
            if (index.isSeriesExists(details.id)) {
                console.log(`   ⚠️ مكرر [ID: ${details.id}]: ${details.title.substring(0, 20)}...`);
                consecutiveDuplicates++;
                
                if (consecutiveDuplicates >= MAX_CONSECUTIVE_DUPLICATES) {
                    console.log(`🛑 توقف: ${MAX_CONSECUTIVE_DUPLICATES} تكرارات متتالية`);
                    break;
                }
                continue;
            }
            
            // إعادة تعيين العداد
            consecutiveDuplicates = 0;
            
            // إضافة للفهرس
            index.addSeries(details.id, details);
            newSeries.push(details);
            totalNew++;
            pageHasNew = true;
            
            // انتظار بين المسلسلات
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // إذا كان هناك تكرارات متتالية كثيرة، توقف
        if (consecutiveDuplicates >= MAX_CONSECUTIVE_DUPLICATES) {
            console.log("🛑 توقف بسبب التكرارات");
            break;
        }
        
        // حفظ الصفحة إذا كان فيها مسلسلات جديدة
        if (newSeries.length > 0) {
            savePage(pageNum, pageData, newSeries);
            index.saveIndex();
        }
        
        console.log(`📊 الصفحة ${pageNum}: ${newSeries.length} جديد`);
        
        // إذا لم يكن هناك مسلسلات جديدة، توقف
        if (!pageHasNew) {
            console.log("⏹️ توقف: لا توجد مسلسلات جديدة");
            break;
        }
        
        // الانتقال للصفحة التالية
        progress.nextPage();
        
        // انتظار بين الصفحات
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // ==================== النتائج ====================
    console.log("\n" + "=".repeat(50));
    console.log("🎉 انتهى الاستخراج");
    console.log(`📊 مسلسلات جديدة: ${totalNew}`);
    console.log(`📋 الفهرس: ${Object.keys(index.series).length} مسلسل`);
    console.log("=".repeat(50));
    
    // حفظ التقرير النهائي
    const report = {
        status: "completed",
        totalNewSeries: totalNew,
        totalSeries: Object.keys(index.series).length,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync("report.json", JSON.stringify(report, null, 2));
}

// التشغيل
main().catch(error => {
    console.error("💥 خطأ:", error.message);
    
    const errorReport = {
        error: error.message,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync("error.json", JSON.stringify(errorReport, null, 2));
});
