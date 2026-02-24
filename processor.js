const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// التأكد من وجود المجلدات
['output', 'temp', 'downloads'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// ========== 20 قالب جديد حسب طلبك ==========
const templates = [
    // قالب 1: لقطة + تجميد 2ث + إعادة بسرعة 0.5
    { name: "قالب 1", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 2.0 },
        { type: "slow", speed: "0.5", duration: 2.0 }
    ]},
    
    // قالب 2: لقطة + تجميد 2ث + عكس + تجميد 2ث
    { name: "قالب 2", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 2.0 },
        { type: "reverse", duration: 2.0 },
        { type: "freeze", duration: 2.0 }
    ]},
    
    // قالب 3: لقطة بسرعة 0.5 + تجميد 2ث + زوم خفيف + تجميد 1ث
    { name: "قالب 3", effects: [
        { type: "slow", speed: "0.5", duration: 2.0 },
        { type: "freeze", duration: 2.0 },
        { type: "zoom", value: "1.2", duration: 2.0 },
        { type: "freeze", duration: 1.0 }
    ]},
    
    // قالب 4: لقطة + تجميد 1ث + عكس مع زوم + تجميد 1ث
    { name: "قالب 4", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "reverse_zoom", value: "1.2", duration: 2.0 },
        { type: "freeze", duration: 1.0 }
    ]},
    
    // قالب 5: لقطة + تجميد 1ث + سرعة 1.2 + تجميد 1ث + سرعة 0.5
    { name: "قالب 5", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "fast", speed: "1.2", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "slow", speed: "0.5", duration: 2.0 }
    ]},
    
    // قالب 6: لقطة + قلب أفقي + تجميد 1ث + زوم خفيف
    { name: "قالب 6", effects: [
        { type: "normal", duration: 2.0 },
        { type: "mirror", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "zoom", value: "1.2", duration: 2.0 }
    ]},
    
    // قالب 7: لقطة بسرعة 0.75 + تجميد 1ث + عكس + طبيعي
    { name: "قالب 7", effects: [
        { type: "slow", speed: "0.75", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "reverse", duration: 2.0 },
        { type: "normal", duration: 2.0 }
    ]},
    
    // قالب 8: لقطة + تجميد 1ث + اهتزاز + تجميد 1ث + زوم داخلي
    { name: "قالب 8", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "shake", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "zoom_in", value: "1.3", duration: 2.0 }
    ]},
    
    // قالب 9: لقطة + سرعة 0.5 + تجميد 1ث + سرعة 1.5
    { name: "قالب 9", effects: [
        { type: "normal", duration: 2.0 },
        { type: "slow", speed: "0.5", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "fast", speed: "1.5", duration: 2.0 }
    ]},
    
    // قالب 10: لقطة + تجميد 1ث + عكس + تجميد 1ث + زوم خارجي
    { name: "قالب 10", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "reverse", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "zoom_out", value: "0.8", duration: 2.0 }
    ]},
    
    // قالب 11: لقطة + سطوع أعلى + تجميد 1ث + سرعة 0.75
    { name: "قالب 11", effects: [
        { type: "normal", duration: 2.0 },
        { type: "brightness", value: "0.2", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "slow", speed: "0.75", duration: 2.0 }
    ]},
    
    // قالب 12: لقطة + تجميد 1ث + تحريك يمين + تجميد 1ث + تحريك يسار
    { name: "قالب 12", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "move_right", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "move_left", duration: 2.0 }
    ]},
    
    // قالب 13: لقطة بسرعة 1.25 + تجميد 1ث + عكس بسرعة 0.75
    { name: "قالب 13", effects: [
        { type: "fast", speed: "1.25", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "reverse", speed: "0.75", duration: 2.0 }
    ]},
    
    // قالب 14: لقطة + blur خفيف + تجميد 1ث + طبيعي
    { name: "قالب 14", effects: [
        { type: "normal", duration: 2.0 },
        { type: "blur", value: "5", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "normal", duration: 2.0 }
    ]},
    
    // قالب 15: لقطة + تجميد 1ث + زوم داخلي + تجميد 1ث + قلب أفقي
    { name: "قالب 15", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "zoom_in", value: "1.3", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "mirror", duration: 2.0 }
    ]},
    
    // قالب 16: لقطة + سرعة 0.5 + عكس + تجميد 1ث
    { name: "قالب 16", effects: [
        { type: "normal", duration: 2.0 },
        { type: "slow", speed: "0.5", duration: 2.0 },
        { type: "reverse", duration: 2.0 },
        { type: "freeze", duration: 1.0 }
    ]},
    
    // قالب 17: لقطة + تجميد 1ث + زوم مع تحريك للأعلى
    { name: "قالب 17", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "zoom_up", value: "1.2", duration: 2.0 }
    ]},
    
    // قالب 18: لقطة + سرعة 1.3 + تجميد 1ث + عكس مع زوم
    { name: "قالب 18", effects: [
        { type: "fast", speed: "1.3", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "reverse_zoom", value: "1.2", duration: 2.0 }
    ]},
    
    // قالب 19: لقطة + تجميد 1ث + تباين عالي + تجميد 1ث
    { name: "قالب 19", effects: [
        { type: "normal", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "contrast", value: "1.5", duration: 2.0 },
        { type: "freeze", duration: 1.0 }
    ]},
    
    // قالب 20: لقطة + سرعة 0.75 + تجميد 1ث + اهتزاز خفيف
    { name: "قالب 20", effects: [
        { type: "slow", speed: "0.75", duration: 2.0 },
        { type: "freeze", duration: 1.0 },
        { type: "shake", duration: 2.0 }
    ]}
];

// دالة للحصول على دقة الفيديو
function getVideoResolution(videoPath) {
    try {
        const output = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`
        ).toString().trim();
        const [width, height] = output.split(',').map(Number);
        return { width, height };
    } catch (error) {
        return { width: 854, height: 480 };
    }
}

// الحصول على مدة ملف الصوت
function getAudioDuration(audioPath) {
    try {
        const output = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
        ).toString();
        return parseFloat(output);
    } catch (error) {
        return 0;
    }
}

// تحويل الوقت من صيغة دقائق:ثواني إلى ثواني
function timeToSeconds(timeStr) {
    const parts = timeStr.split(":");
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseInt(timeStr);
}

// قراءة ملف النص
function parseScriptFile(scriptPath) {
    const content = fs.readFileSync(scriptPath, "utf8");
    const lines = content.split("\n").filter(line => line.trim() !== "");
    
    const scenes = [];
    
    for (const line of lines) {
        const match = line.match(/(\d+:\d+)-(\d+:\d+)\s*\|\s*(.+)/);
        
        if (match) {
            const startTime = timeToSeconds(match[1]);
            const endTime = timeToSeconds(match[2]);
            
            scenes.push({
                start: startTime,
                end: endTime,
                duration: endTime - startTime,
                text: match[3]
            });
        }
    }
    
    return scenes;
}

// تطبيق قالب عشوائي على مقطع (نسخة سريعة)
async function applyRandomTemplate(videoPath, startTime, sceneIndex, outputPath) {
    console.log(`   🎨 تطبيق قالب عشوائي على المشهد ${sceneIndex + 1}`);
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    const template = templates[randomIndex];
    console.log(`      📋 القالب المختار: ${template.name}`);
    
    // قص المقطع الأصلي (2 ثانية) - باستخدام ultrafast للتسريع
    const originalClip = `temp/scene_${sceneIndex}_original.mp4`;
    
    execSync(
        `ffmpeg -y -ss ${startTime} -i "${videoPath}" -t 2 -c copy -avoid_negative_ts make_zero "${originalClip}"`,
        { stdio: 'pipe' }
    );
    
    // الحصول على دقة الفيديو الأصلي
    const { width, height } = getVideoResolution(originalClip);
    
    // تطبيق التأثيرات حسب القالب
    const effectFiles = [];
    
    for (let i = 0; i < template.effects.length; i++) {
        const effect = template.effects[i];
        const effectOutput = `temp/scene_${sceneIndex}_effect_${i}.mp4`;
        
        let filter = '';
        
        switch(effect.type) {
            case 'normal':
                filter = 'null';
                break;
            case 'freeze':
                filter = `loop=loop=${effect.duration * 30}:size=1,setpts=N/FRAME_RATE/TB`;
                break;
            case 'slow':
                filter = `setpts=${effect.speed}*PTS`;
                break;
            case 'fast':
                filter = `setpts=${effect.speed}*PTS`;
                break;
            case 'reverse':
                filter = 'reverse';
                break;
            case 'reverse_zoom':
                filter = `reverse,zoompan=z='min(zoom+0.01,${effect.value})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'zoom':
            case 'zoom_in':
                filter = `zoompan=z='min(zoom+0.01,${effect.value})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'zoom_out':
                filter = `zoompan=z='max(zoom-0.01,${effect.value})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'zoom_up':
                filter = `zoompan=z='min(zoom+0.01,${effect.value})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-10':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'mirror':
                filter = 'hflip';
                break;
            case 'brightness':
                filter = `eq=brightness=${effect.value}`;
                break;
            case 'contrast':
                filter = `eq=contrast=${effect.value}`;
                break;
            case 'blur':
                filter = `boxblur=${effect.value}`;
                break;
            case 'shake':
                filter = `shake=1.5:5:10`;
                break;
            case 'move_right':
                filter = `pad=iw+100:ih:ow-100:0,zoompan=z=1:x='min(100,on)*2':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'move_left':
                filter = `pad=iw+100:ih:0:0,zoompan=z=1:x='max(0,100-on)*2':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            default:
                filter = 'null';
        }
        
        const inputFile = i === 0 ? originalClip : effectFiles[i-1];
        
        // استخدام preset ultrafast للتسريع
        if (filter !== 'null' && filter !== '') {
            try {
                execSync(
                    `ffmpeg -y -i "${inputFile}" -vf "${filter}" -c:v libx264 -preset ultrafast -t ${effect.duration} "${effectOutput}"`,
                    { stdio: 'pipe' }
                );
            } catch (error) {
                execSync(
                    `ffmpeg -y -i "${inputFile}" -c copy -t ${effect.duration} "${effectOutput}"`,
                    { stdio: 'pipe' }
                );
            }
        } else {
            execSync(
                `ffmpeg -y -i "${inputFile}" -c copy -t ${effect.duration} "${effectOutput}"`,
                { stdio: 'pipe' }
            );
        }
        
        effectFiles.push(effectOutput);
    }
    
    // دمج جميع التأثيرات للمشهد الواحد
    const listFile = `temp/scene_${sceneIndex}_list.txt`;
    const content = effectFiles.map(f => `file '${path.resolve(f)}'`).join("\n");
    fs.writeFileSync(listFile, content);
    
    execSync(
        `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`,
        { stdio: 'pipe' }
    );
    
    // تنظيف الملفات المؤقتة للمشهد
    effectFiles.forEach(f => {
        try { fs.unlinkSync(f); } catch (e) {}
    });
    try { fs.unlinkSync(listFile); } catch (e) {}
    try { fs.unlinkSync(originalClip); } catch (e) {}
    
    return outputPath;
}

// دالة تحميل الفيديو
async function downloadVideo(url, outputPath) {
    console.log(`📥 تحميل الفيديو من: ${url}`);
    
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000,
            maxContentLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log(`✅ تم التحميل: ${outputPath}`);
        return outputPath;
        
    } catch (error) {
        console.error("❌ فشل التحميل:", error.message);
        throw error;
    }
}

// دمج الفيديو مع الصوت
function mergeWithAudio(videoPath, audioPath, outputPath) {
    console.log("🎵 دمج الفيديو مع الصوت...");
    
    execSync(
        `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`,
        { stdio: 'pipe' }
    );
    
    return outputPath;
}

// ============= الوظيفة الرئيسية =============
async function main() {
    console.log("🚀 بدء مشروع ملخص الأفلام التلقائي");
    console.log("=".repeat(50));
    
    const videoUrl = process.argv[2];
    const scriptFile = process.argv[3] || "script.txt";
    const audioFile = process.argv[4] || "Sund.mp3";
    
    if (!videoUrl) {
        console.error("❌ الرجاء تحديد رابط الفيديو");
        process.exit(1);
    }
    
    if (!fs.existsSync(scriptFile)) {
        console.error(`❌ ملف النص ${scriptFile} غير موجود`);
        process.exit(1);
    }
    
    if (!fs.existsSync(audioFile)) {
        console.error(`❌ ملف الصوت ${audioFile} غير موجود`);
        process.exit(1);
    }
    
    // قراءة المشاهد
    console.log(`📄 قراءة ملف النص: ${scriptFile}`);
    const availableScenes = parseScriptFile(scriptFile);
    console.log(`✅ المشاهد المتاحة: ${availableScenes.length} مشهد`);
    
    // مدة الصوت
    const audioDuration = getAudioDuration(audioFile);
    console.log(`🎵 مدة ملف الصوت: ${audioDuration.toFixed(1)} ثانية`);
    
    // حساب عدد المشاهد المطلوبة (كل مشهد حوالي 6-8 ثواني حسب القالب)
    const avgSceneDuration = 7.0;
    const requiredScenesCount = Math.floor(audioDuration / avgSceneDuration);
    console.log(`📊 نحتاج: ${requiredScenesCount} مشهد تقريباً`);
    
    // اختيار المشاهد بالترتيب مع التكرار
    const selectedScenes = [];
    for (let i = 0; i < requiredScenesCount; i++) {
        const sceneIndex = i % availableScenes.length;
        selectedScenes.push(availableScenes[sceneIndex]);
    }
    
    console.log(`📋 تم اختيار ${selectedScenes.length} مشهد`);
    
    // 1️⃣ تحميل الفيديو
    console.log("\n📥 المرحلة 1: تحميل الفيديو...");
    const downloadedVideo = "downloads/video.mp4";
    await downloadVideo(videoUrl, downloadedVideo);
    
    // 2️⃣ معالجة المشاهد
    console.log("\n🎬 المرحلة 2: معالجة المشاهد...");
    const sceneVideos = [];
    
    for (let i = 0; i < selectedScenes.length; i++) {
        const scene = selectedScenes[i];
        console.log(`\n🎬 معالجة المشهد ${i + 1}/${selectedScenes.length}`);
        console.log(`   ⏱️  ${Math.floor(scene.start/60)}:${Math.floor(scene.start%60).toString().padStart(2,'0')}`);
        
        const finalScenePath = `temp/scene_${i}_final.mp4`;
        await applyRandomTemplate(downloadedVideo, scene.start, i, finalScenePath);
        sceneVideos.push(finalScenePath);
    }
    
    // 3️⃣ دمج المشاهد
    console.log("\n🔗 المرحلة 3: دمج المشاهد...");
    const concatedVideo = `temp/concated.mp4`;
    
    const listFile = "temp/final_list.txt";
    const content = sceneVideos.map(v => `file '${path.resolve(v)}'`).join("\n");
    fs.writeFileSync(listFile, content);
    
    execSync(
        `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${concatedVideo}"`,
        { stdio: 'pipe' }
    );
    
    // 4️⃣ إضافة الصوت
    console.log("\n🎵 المرحلة 4: إضافة الصوت...");
    const timestamp = new Date().getTime();
    const finalVideo = `output/final_${timestamp}.mp4`;
    
    mergeWithAudio(concatedVideo, audioFile, finalVideo);
    
    // عرض النتيجة
    const stats = fs.statSync(finalVideo);
    console.log(`\n✅✅✅ تم بنجاح! ✅✅✅`);
    console.log(`   📁 الفيديو: ${finalVideo}`);
    console.log(`   📦 الحجم: ${(stats.size / (1024*1024)).toFixed(2)} MB`);
    console.log(`   🎬 المشاهد: ${selectedScenes.length}`);
    console.log(`   🎨 القوالب: 20 قالب عشوائي`);
    
    // تنظيف
    console.log("\n🧹 تنظيف...");
    try {
        const tempDir = 'temp';
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                if (file.endsWith('.mp4') || file.endsWith('.txt')) {
                    try { fs.unlinkSync(path.join(tempDir, file)); } catch (e) {}
                }
            });
        }
    } catch (error) {}
    
    console.log("\n✨ انتهى!");
}

if (require.main === module) {
    main().catch(error => {
        console.error("❌ خطأ:", error);
        process.exit(1);
    });
}
