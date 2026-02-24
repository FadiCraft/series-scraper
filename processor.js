const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// ==================== الإعدادات مع تحسين المسارات ====================
const INPUT_VIDEO = 'input/video.mp4';
const INPUT_AUDIO = 'input/sound.mp3';
const SCRIPT_FILE = 'script.txt';
const OUTPUT_FILE = 'output/final_summary.mp4';
const TEMP_FOLDER = 'temp_clips/';

// دالة للتأكد من وجود المجلدات مع صلاحيات كاملة
function ensureDir(dirPath) {
    try {
        // إنشاء المجلد مع الصلاحيات الكاملة
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o777 });
        console.log(`📁 مجلد جاهز: ${dirPath}`);
        
        // تأكد من إمكانية الكتابة
        fs.accessSync(dirPath, fs.constants.W_OK);
        console.log(`✅ صلاحيات الكتابة: متوفرة`);
    } catch (err) {
        console.error(`❌ خطأ في المجلد ${dirPath}:`, err.message);
        throw err;
    }
}

// إنشاء المجلدات
ensureDir(TEMP_FOLDER);
ensureDir('output');
ensureDir('input');

// ==================== دوال مساعدة ====================

function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
}

function checkFiles() {
    if (!fs.existsSync(INPUT_VIDEO)) {
        throw new Error(`❌ ملف الفيديو غير موجود: ${INPUT_VIDEO}`);
    }
    if (!fs.existsSync(SCRIPT_FILE)) {
        throw new Error(`❌ ملف السكريبت غير موجود: ${SCRIPT_FILE}`);
    }
    
    const hasAudio = fs.existsSync(INPUT_AUDIO);
    console.log('✅ الفيديو: موجود');
    console.log('✅ السكريبت: موجود');
    console.log(`✅ الصوت: ${hasAudio ? 'موجود' : 'غير موجود'}`);
    
    return hasAudio;
}

function readScript() {
    const data = fs.readFileSync(SCRIPT_FILE, 'utf-8');
    const lines = data.split('\n').filter(l => l.trim() !== '');
    const segments = [];

    lines.forEach((line, i) => {
        const match = line.match(/(\d{2}:\d{2})-(\d{2}:\d{2})\s*\|\s*(.+)/);
        if (match) {
            const start = timeToSeconds(match[1]);
            const end = timeToSeconds(match[2]);
            segments.push({
                id: i,
                start: start,
                end: end,
                duration: end - start,
                text: match[3].trim()
            });
            console.log(`📋 مقطع ${i+1}: ${match[1]}-${match[2]} (${(end-start).toFixed(1)}ث)`);
        }
    });

    console.log(`📋 المجموع: ${segments.length} مقطع`);
    return segments;
}

// دالة معدلة لإنشاء المقطع مع معالجة أفضل للأخطاء
async function createSegment(segment, index) {
    return new Promise((resolve, reject) => {
        const outputFile = path.join(TEMP_FOLDER, `segment_${index.toString().padStart(3, '0')}.mp4`);
        
        console.log(`🎬 معالجة المقطع ${index+1}: ${segment.start}s - ${segment.end}s`);
        
        // التأكد من أن المجلد موجود وقابل للكتابة
        try {
            fs.writeFileSync(path.join(TEMP_FOLDER, 'test.txt'), 'test');
            fs.unlinkSync(path.join(TEMP_FOLDER, 'test.txt'));
        } catch (err) {
            reject(new Error(`المجلد ${TEMP_FOLDER} غير قابل للكتابة: ${err.message}`));
            return;
        }
        
        // تأثير عشوائي
        const zoom = 0.95 + Math.random() * 0.1;
        
        const command = ffmpeg(INPUT_VIDEO)
            .inputOptions(['-ss', segment.start.toString(), '-t', segment.duration.toString()])
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
                '-an',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-crf', '28'
            ])
            .output(outputFile)
            .on('start', (cmd) => {
                // console.log('🔧 أمر FFmpeg:', cmd);
            })
            .on('end', () => {
                // التحقق من أن الملف أنشئ بالفعل
                if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
                    console.log(`   ✅ المقطع ${index+1} جاهز (${(fs.statSync(outputFile).size/1024/1024).toFixed(2)} MB)`);
                    resolve(outputFile);
                } else {
                    reject(new Error(`الملف ${outputFile} لم يتم إنشاؤه بشكل صحيح`));
                }
            })
            .on('error', (err) => {
                console.error(`   ❌ خطأ FFmpeg للمقطع ${index+1}:`, err.message);
                reject(err);
            });
        
        // تشغيل الأمر
        command.run();
    });
}

async function mergeSegments(files, hasAudio) {
    return new Promise((resolve, reject) => {
        console.log('\n🔗 دمج المقاطع...');
        
        const listFile = path.join(TEMP_FOLDER, 'list.txt');
        const content = files.map(f => `file '${path.resolve(f)}'`).join('\n');
        fs.writeFileSync(listFile, content);
        
        let command = ffmpeg()
            .input(listFile)
            .inputOptions(['-f', 'concat', '-safe', '0']);
        
        const options = [
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p'
        ];
        
        if (hasAudio && fs.existsSync(INPUT_AUDIO)) {
            console.log('🎵 دمج مع الصوت المنفصل');
            command = command.input(INPUT_AUDIO);
            options.push('-map', '0:v:0');
            options.push('-map', '1:a:0');
            options.push('-c:a', 'aac');
            options.push('-shortest');
        } else {
            console.log('🔇 استخدام الصوت من الفيديو');
            options.push('-an'); // بدون صوت للتبسيط
        }
        
        command
            .outputOptions(options)
            .output(OUTPUT_FILE)
            .on('end', () => {
                if (fs.existsSync(OUTPUT_FILE)) {
                    const size = fs.statSync(OUTPUT_FILE).size / 1024 / 1024;
                    console.log(`\n🎉 تم الإنشاء! الحجم: ${size.toFixed(2)} MB`);
                    resolve();
                } else {
                    reject(new Error('ملف الإخراج لم يتم إنشاؤه'));
                }
            })
            .on('error', reject)
            .run();
    });
}

async function main() {
    console.log('🚀 بدء معالجة الفيديو...\n');
    
    try {
        // عرض معلومات النظام
        console.log(`📁 المسار الحالي: ${process.cwd()}`);
        console.log(`📁 المجلد المؤقت: ${path.resolve(TEMP_FOLDER)}`);
        
        // 1. التحقق
        const hasAudio = checkFiles();
        
        // 2. قراءة السكريبت
        const segments = readScript();
        if (segments.length === 0) {
            throw new Error('لا توجد مقاطع صالحة');
        }
        
        // 3. إنشاء المقاطع
        console.log('\n⏳ إنشاء المقاطع...');
        const files = [];
        
        // معالجة أول مقطع فقط للتجربة (أو كل المقاطع)
        const maxSegments = Math.min(segments.length, 3); // جرب 3 مقاطع فقط
        for (let i = 0; i < maxSegments; i++) {
            const file = await createSegment(segments[i], i);
            files.push(file);
        }
        
        if (files.length === 0) {
            throw new Error('لم يتم إنشاء أي مقاطع');
        }
        
        // 4. الدمج
        await mergeSegments(files, hasAudio);
        
        // 5. تنظيف
        console.log('\n🧹 تنظيف...');
        files.forEach(f => {
            try { fs.unlinkSync(f); } catch (e) {}
        });
        try { fs.unlinkSync(path.join(TEMP_FOLDER, 'list.txt')); } catch (e) {}
        
        console.log('\n✅ تم بنجاح!');
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ فشل:', err.message);
        console.error('📋 تفاصيل:', err);
        process.exit(1);
    }
}

// تشغيل
main();
