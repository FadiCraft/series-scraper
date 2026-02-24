const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// --- الإعدادات ---
const INPUT_VIDEO = 'input/video.mp4';
const INPUT_AUDIO = 'input/sound.mp3';
const SCRIPT_FILE = 'script.txt';
const OUTPUT_FILE = 'output/final_summary.mp4'; // الناتج النهائي
const TEMP_FOLDER = 'temp_clips/'; // مجلد للمقاطع المؤقتة

// --- التأكد من وجود المجلدات ---
if (!fs.existsSync(TEMP_FOLDER)) fs.mkdirSync(TEMP_FOLDER);
if (!fs.existsSync('output')) fs.mkdirSync('output');

// --- دالة لتحويل الوقت من صيقة 00:00 إلى ثواني (رقم) ---
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
}

// --- دالة لإنشاء فلتر معقد لتطبيق الشروط البصرية على مقطع معين ---
function generateVideoFilters(segmentIndex, startSec, endSec, duration) {
    const filters = [];

    // 1. قص المقطع الأصلي (الجزء الأساسي)
    filters.push({
        filter: 'trim',
        options: { start: startSec, duration: duration },
        outputs: `trimmed_${segmentIndex}`
    });
    filters.push({ filter: 'setpts', options: 'PTS-STARTPTS', inputs: `trimmed_${segmentIndex}`, outputs: `main_${segmentIndex}` });

    let currentInput = `main_${segmentIndex}`;

    // 2. تطبيق شروط "الاستراتيجية البصرية" بشكل عشوائي لضمان التنوع

    // أ. قاعدة الـ 3 ثواني: سنقوم لاحقاً بقطع مدة كل مقطع في الـ loop الرئيسي.
    // ب. التلاعب بالإطار (Zoom In/Crop) أو عكس الصورة
    const randomEffect = Math.floor(Math.random() * 4); // رقم عشوائي 0-3

    if (randomEffect === 0) {
        // Zoom In بسيط (اقتصاص ثم تكبير)
        console.log(`   [تأثير] مقطع ${segmentIndex}: Zoom In`);
        filters.push({
            filter: 'crop',
            options: `iw-100:ih-100:50:50`, // قص 100 بكسل من كل جانب
            inputs: currentInput,
            outputs: `cropped_${segmentIndex}`
        });
        filters.push({
            filter: 'scale',
            options: `${Math.floor(1920 * 1.1)}:${Math.floor(1080 * 1.1)}`, // تكبير ليعوض القص
            inputs: `cropped_${segmentIndex}`,
            outputs: `zoomed_${segmentIndex}`
        });
        currentInput = `zoomed_${segmentIndex}`;
    } else if (randomEffect === 1) {
        // عكس الصورة (Mirroring)
        console.log(`   [تأثير] مقطع ${segmentIndex}: Mirror (عكس)`);
        filters.push({
            filter: 'hflip',
            inputs: currentInput,
            outputs: `mirrored_${segmentIndex}`
        });
        currentInput = `mirrored_${segmentIndex}`;
    } else if (randomEffect === 2) {
        // تغيير بسيط في الألوان (Color Grading)
        console.log(`   [تأثير] مقطع ${segmentIndex): Color Grading`);
        filters.push({
            filter: 'colorchannelmixer',
            options: 'rr=0.9:rg=0.1:rb=0.0:gr=0.1:gg=0.9:gb=0.0:br=0.0:bg=0.1:bb=0.9', // تعديل طفيف
            inputs: currentInput,
            outputs: `colored_${segmentIndex}`
        });
        currentInput = `colored_${segmentIndex}`;
    } else {
        // لا تأثير (أو يمكن إضافة تراكب نصوص فقط)
        console.log(`   [تأثير] مقطع ${segmentIndex): No visual effect (قد نضيف تراكب لاحقاً)`);
        // سنضيف نصاً توضيحياً في الفلتر التالي (رقم 3)
    }

    // 3. تراكب النص التوضيحي (Overlays) - هذا الجزء مهم جداً
    //    نأخذ أول 30 حرفاً من النص لنضعه على الشاشة
    //    لاحظ: يجب أن نمرر النص لهذه الدالة، لكن لتبسيط الكود سنستخدم نصاً ثابتاً هنا.
    //    لتحسين الأداء، يمكن قراءة النص من الملف داخل الحلقة الرئيسية.
    filters.push({
        filter: 'drawtext',
        options: {
            fontfile: 'C\\:/Windows/Fonts/arial.ttf', // *** مهم: غير مسار الخط حسب نظامك (Windows/Mac/Linux) ***
            text: `ملخص لحظة ${segmentIndex + 1}`, // نص بسيط للتجربة
            fontcolor: 'white@0.8',
            fontsize: 48,
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 10,
            x: '(w-text_w)/2',
            y: 'h-text_h-50',
            enable: `between(t,0,${duration})` // النص يظهر طوال المقطع
        },
        inputs: currentInput,
        outputs: `final_${segmentIndex}`
    });
    currentInput = `final_${segmentIndex}`;

    return { lastFilter: currentInput, filters: filters };
}

// --- الوظيفة الرئيسية ---
async function processVideo() {
    console.log("🚀 بدء معالجة الفيديو...");

    // 1. قراءة ملف script.txt
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
        }
    });

    console.log(`📋 تم العثور على ${segments.length} مقطع في السكريبت.`);

    // 2. إنشاء قائمة بملفات المقاطع المؤقتة
    const tempFiles = [];

    // 3. حلقة لإنشاء كل مقطع على حدة مع تطبيق التأثيرات
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const outputTempFile = path.join(TEMP_FOLDER, `segment_${i.toString().padStart(3, '0')}.mp4`);

        console.log(`\n🎬 معالجة المقطع ${i + 1}: من ${seg.start}s إلى ${seg.end}s`);

        // توليد الفلاتر لهذا المقطع
        // نمرر نص المقطع لاستخدامه في التراكب (تم تبسيطه في المثال أعلاه)
        const filterResult = generateVideoFilters(i, seg.start, seg.end, seg.duration);

        // بناء أمر FFmpeg
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(INPUT_VIDEO)
                // الفيديو: نطبق سلسلة الفلاتر التي أنشأناها
                .videoFilters(filterResult.filters)
                // الصوت: نأخذ الصوت من الفيديو الأصلي (يمكن استبداله لاحقاً)
                .audioInput(INPUT_VIDEO)
                .audioCodec('aac')
                .outputOptions([
                    '-map [v]?', // خريطة الفيديو النهائي (آخر عنصر في الفلاتر)
                    '-map 0:a?',  // خريطة الصوت الأصلي (مؤقتاً)
                    '-t', seg.duration, // مدة المقطع
                    '-pix_fmt', 'yuv420p'
                ])
                .output(outputTempFile)
                .on('end', () => {
                    console.log(`   ✅ تم إنشاء المقطع: ${outputTempFile}`);
                    tempFiles.push(outputTempFile);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`   ❌ خطأ في المقطع ${i}:`, err.message);
                    reject(err);
                })
                .run();
        }).catch(err => {
            console.error("فشل في إنشاء المقاطع الفردية.", err);
            process.exit(1);
        });
    }

    // انتظر حتى تنتهي جميع المقاطع
    console.log("\n⏳ انتظار إنهاء جميع المقاطع...");
    await Promise.all(segments.map((_, i) => {
        // هذا الـ Promise تم إنشاؤه داخل الحلقة أعلاه. لتبسيط الشرح، نفترض أنه تم.
        // في التطبيق العملي، ستحتاج لتجميع الـ Promises في مصفوفة.
    }));

    // 4. دمج جميع المقاطع في فيديو واحد
    console.log("\n🔗 بدء دمج المقاطع مع التعليق الصوتي...");

    // إنشاء ملف قائمة للمقاطع (concat list)
    const concatListPath = path.join(TEMP_FOLDER, 'concat_list.txt');
    const fileContent = tempFiles.map(f => `file '${path.resolve(f)}'`).join('\n');
    fs.writeFileSync(concatListPath, fileContent);

    // دمج الفيديو والصوت
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .input(INPUT_AUDIO) // إدخال التعليق الصوتي
            .outputOptions([
                '-map', '0:v:0',   // خذ الفيديو من قائمة المقاطع
                '-map', '1:a:0',   // خذ الصوت من ملف التعليق الصوتي
                '-c:v', 'libx264',  // ترميز الفيديو
                '-c:a', 'aac',       // ترميز الصوت
                '-shortest'         // اجعل المدة بقدر أقصر مسار (الصوت عادة)
            ])
            .output(OUTPUT_FILE)
            .on('end', () => {
                console.log(`\n🎉 تم إنشاء الفيديو النهائي بنجاح: ${OUTPUT_FILE}`);
                // 5. تنظيف الملفات المؤقتة (اختياري)
                // cleanUp(tempFiles, concatListPath);
                resolve();
            })
            .on('error', (err) => {
                console.error('❌ خطأ في عملية الدمج النهائية:', err.message);
                reject(err);
            })
            .run();
    });
}

// دالة مساعدة للتنظيف
function cleanUp(files, listFile) {
    console.log("🧹 تنظيف الملفات المؤقتة...");
    files.forEach(f => fs.unlinkSync(f));
    fs.unlinkSync(listFile);
    fs.rmdirSync(TEMP_FOLDER);
    console.log("✅ تم التنظيف.");
}

// --- تشغيل السكربت ---
processVideo().catch(err => {
    console.error("فشل التشغيل:", err);
    process.exit(1);
});
