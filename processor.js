const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// --- الإعدادات المعدلة لـ GitHub Actions ---
const INPUT_VIDEO = 'input/video.mp4';
const INPUT_AUDIO = 'input/sound.mp3';
const SCRIPT_FILE = 'script.txt';
const OUTPUT_FILE = 'output/final_summary.mp4';
const TEMP_FOLDER = 'temp_clips/';

// --- التأكد من وجود المجلدات ---
if (!fs.existsSync(TEMP_FOLDER)) fs.mkdirSync(TEMP_FOLDER, { recursive: true });
if (!fs.existsSync('output')) fs.mkdirSync('output', { recursive: true });

// --- دالة لتحويل الوقت من صيغة 00:00 إلى ثواني ---
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
}

// --- دالة للتحقق من وجود الملفات ---
function checkFiles() {
    const files = [
        { path: INPUT_VIDEO, name: 'الفيديو' },
        { path: INPUT_AUDIO, name: 'الصوت' },
        { path: SCRIPT_FILE, name: 'السكريبت' }
    ];
    
    files.forEach(file => {
        if (!fs.existsSync(file.path)) {
            throw new Error(`❌ ملف ${file.name} غير موجود: ${file.path}`);
        }
    });
    console.log("✅ جميع الملفات موجودة");
}

// --- دالة لقراءة السكريبت ---
function readScript() {
    const scriptData = fs.readFileSync(SCRIPT_FILE, 'utf-8');
    const lines = scriptData.split('\n').filter(line => line.trim() !== '');
    const segments = [];

    lines.forEach((line, index) => {
        const match = line.match(/(\d{2}:\d{2})-(\d{2}:\d{2})\s*\|\s*(.+)/);
        if (match) {
            const start = timeToSeconds(match[1]);
            const end = timeToSeconds(match[2]);
            segments.push({
                id: index,
                start: start,
                end: end,
                duration: end - start,
                text: match[3].trim()
            });
            console.log(`📋 مقطع ${index + 1}: ${match[1]} - ${match[2]} (${end - start} ثانية)`);
        }
    });

    console.log(`📋 تم العثور على ${segments.length} مقطع`);
    return segments;
}

// --- دالة لإنشاء تأثير بصري بسيط (بدون خطوط معقدة) ---
async function createSegment(segment, index) {
    return new Promise((resolve, reject) => {
        const outputFile = path.join(TEMP_FOLDER, `segment_${index.toString().padStart(3, '0')}.mp4`);
        
        // تأثير بسيط: تكبير/تصغير عشوائي بدون استخدام خطوط
        const zoom = 0.9 + Math.random() * 0.2; // بين 0.9 و 1.1
        
        console.log(`🎬 معالجة المقطع ${index + 1}: ${segment.start}s - ${segment.end}s (تأثير: zoom ${zoom.toFixed(2)})`);
        
        ffmpeg()
            .input(INPUT_VIDEO)
            .inputOptions(['-ss', segment.start, '-t', segment.duration])
            .videoFilters([
                {
                    filter: 'scale',
                    options: `iw*${zoom}:ih*${zoom}`,
                    outputs: 'scaled'
                },
                {
                    filter: 'crop',
                    options: `iw/${zoom}:ih/${zoom}`,
                    inputs: 'scaled',
                    outputs: 'cropped'
                }
            ])
            .outputOptions([
                '-map [cropped]',
                '-an', // بدون صوت مؤقتاً
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast', // للمعالجة السريعة
                '-crf', '28' // جودة مقبولة مع حجم أصغر
            ])
            .output(outputFile)
            .on('end', () => {
                console.log(`   ✅ تم إنشاء المقطع ${index + 1}`);
                resolve(outputFile);
            })
            .on('error', (err) => {
                console.error(`   ❌ خطأ في المقطع ${index + 1}:`, err.message);
                reject(err);
            })
            .run();
    });
}

// --- دالة دمج المقاطع مع الصوت ---
async function mergeSegments(segmentFiles) {
    return new Promise((resolve, reject) => {
        console.log("\n🔗 دمج المقاطع مع الصوت...");
        
        // إنشاء ملف قائمة للمقاطع
        const concatList = path.join(TEMP_FOLDER, 'concat_list.txt');
        const fileContent = segmentFiles.map(f => `file '${path.resolve(f)}'`).join('\n');
        fs.writeFileSync(concatList, fileContent);
        
        ffmpeg()
            .input(concatList)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .input(INPUT_AUDIO)
            .outputOptions([
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'medium',
                '-crf', '23',
                '-shortest'
            ])
            .output(OUTPUT_FILE)
            .on('end', () => {
                console.log(`\n🎉 تم إنشاء الفيديو النهائي: ${OUTPUT_FILE}`);
                
                // التحقق من حجم الملف
                const stats = fs.statSync(OUTPUT_FILE);
                console.log(`📊 حجم الفيديو: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                resolve();
            })
            .on('error', (err) => {
                console.error('❌ خطأ في الدمج:', err.message);
                reject(err);
            })
            .run();
    });
}

// --- الوظيفة الرئيسية ---
async function main() {
    console.log("🚀 بدء معالجة الفيديو في GitHub Actions...\n");
    
    try {
        // 1. التحقق من الملفات
        checkFiles();
        
        // 2. قراءة السكريبت
        const segments = readScript();
        
        if (segments.length === 0) {
            throw new Error("❌ لا توجد مقاطع صالحة في ملف السكريبت");
        }
        
        // 3. إنشاء المقاطع
        console.log("\n⏳ بدء إنشاء المقاطع...");
        const segmentFiles = [];
        
        for (let i = 0; i < segments.length; i++) {
            const file = await createSegment(segments[i], i);
            segmentFiles.push(file);
        }
        
        // 4. دمج المقاطع
        await mergeSegments(segmentFiles);
        
        // 5. تنظيف الملفات المؤقتة (اختياري)
        console.log("\n🧹 تنظيف الملفات المؤقتة...");
        segmentFiles.forEach(f => {
            try { fs.unlinkSync(f); } catch (e) { }
        });
        try { fs.unlinkSync(path.join(TEMP_FOLDER, 'concat_list.txt')); } catch (e) { }
        
        console.log("✅ تم الانتهاء بنجاح!");
        process.exit(0);
        
    } catch (error) {
        console.error("\n❌ فشل المعالجة:", error.message);
        process.exit(1);
    }
}

// --- تشغيل السكربت ---
main();
