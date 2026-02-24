const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const youtubedl = require('youtube-dl-exec');

// التأكد من وجود المجلدات
['output', 'temp', 'downloads'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// ========== دالة تحميل الفيديو ==========
async function downloadVideo(url, outputPath) {
  console.log(`📥 تحميل الفيديو من: ${url}`);
  
  try {
    // استخدام axios للتحميل المباشر
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

// دالة للحصول على دقة الفيديو
function getVideoResolution(videoPath) {
    try {
        const output = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`
        ).toString().trim();
        const [width, height] = output.split(',').map(Number);
        return { width, height };
    } catch (error) {
        console.log("⚠️ لا يمكن قراءة دقة الفيديو، استخدام القيم الافتراضية");
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
        console.error("❌ خطأ في قراءة مدة الصوت:", error.message);
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

// ========== قوالب التأثيرات العشرة ==========
const templates = [
    // قالب 1
    { name: "قالب 1", effects: [
        { type: "zoom", value: "1.2", duration: 1.0 },
        { type: "freeze", duration: 1.5 },
        { type: "color", value: "colorbalance=rs=0.1:gs=-0.1:bs=-0.1", duration: 2.0 },
        { type: "normal", duration: 2.5 }
    ]},
    // قالب 2
    { name: "قالب 2", effects: [
        { type: "brightness", value: "0.1", duration: 1.5 },
        { type: "freeze_zoom", duration: 2.0, zoom: "1.3" },
        { type: "crop", value: "0.8", duration: 2.5 },
        { type: "normal", duration: 1.5 }
    ]},
    // قالب 3
    { name: "قالب 3", effects: [
        { type: "mirror", duration: 1.5 },
        { type: "slow", speed: "0.7", duration: 2.0 },
        { type: "cut", duration: 0.5 },
        { type: "zoom", value: "1.4", duration: 2.5 }
    ]},
    // قالب 4
    { name: "قالب 4", effects: [
        { type: "slow", speed: "0.6", duration: 2.0 },
        { type: "contrast", value: "1.3", duration: 1.5 },
        { type: "freeze", duration: 1.5 },
        { type: "normal", duration: 2.0 }
    ]},
    // قالب 5
    { name: "قالب 5", effects: [
        { type: "zoom", value: "1.15", duration: 1.5 },
        { type: "cut", duration: 0.3 },
        { type: "hue", value: "hue=h=10:s=1.2", duration: 2.5 },
        { type: "normal", duration: 2.0 }
    ]},
    // قالب 6
    { name: "قالب 6", effects: [
        { type: "crop_vertical", value: "0.7", duration: 1.5 },
        { type: "slow", speed: "0.5", duration: 2.0 },
        { type: "freeze", duration: 1.5 },
        { type: "normal", duration: 2.0 }
    ]},
    // قالب 7
    { name: "قالب 7", effects: [
        { type: "color_temp", value: "colorbalance=rs=0.2:bs=-0.1", duration: 1.5 },
        { type: "mirror", duration: 1.5 },
        { type: "cut", duration: 0.4 },
        { type: "zoom", value: "1.25", duration: 2.5 }
    ]},
    // قالب 8
    { name: "قالب 8", effects: [
        { type: "reverse", duration: 2.0 },
        { type: "zoom", value: "1.1", duration: 1.5 },
        { type: "freeze", duration: 1.5 },
        { type: "normal", duration: 2.0 }
    ]},
    // قالب 9
    { name: "قالب 9", effects: [
        { type: "saturation", value: "0.7", duration: 1.5 },
        { type: "freeze", duration: 1.5 },
        { type: "slow", speed: "0.8", duration: 2.0 },
        { type: "normal", duration: 2.0 }
    ]},
    // قالب 10
    { name: "قالب 10", effects: [
        { type: "zoom", value: "1.2", duration: 1.5 },
        { type: "slow", speed: "0.6", duration: 2.0 },
        { type: "cut", duration: 0.3 },
        { type: "normal", duration: 2.5 }
    ]}
];

// تطبيق قالب عشوائي على مقطع
async function applyRandomTemplate(videoPath, startTime, sceneIndex, outputPath) {
    console.log(`   🎨 تطبيق قالب عشوائي على المشهد ${sceneIndex + 1}`);
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    const template = templates[randomIndex];
    console.log(`      📋 القالب المختار: ${template.name}`);
    
    // قص المقطع الأصلي (2 ثانية)
    const originalClip = `temp/scene_${sceneIndex}_original.mp4`;
    
    execSync(
        `ffmpeg -y -ss ${startTime} -i "${videoPath}" -t 2 -c copy -avoid_negative_ts make_zero "${originalClip}"`,
        { stdio: 'pipe' }
    );
    
    // الحصول على دقة الفيديو الأصلي
    const { width, height } = getVideoResolution(originalClip);
    console.log(`      📐 دقة الفيديو: ${width}x${height}`);
    
    // تطبيق التأثيرات حسب القالب
    const effectFiles = [];
    
    for (let i = 0; i < template.effects.length; i++) {
        const effect = template.effects[i];
        const effectOutput = `temp/scene_${sceneIndex}_effect_${i}.mp4`;
        
        let filter = '';
        
        switch(effect.type) {
            case 'zoom':
                filter = `zoompan=z='min(zoom+0.01,${effect.value})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'freeze':
                filter = `loop=loop=${effect.duration * 30}:size=1,setpts=N/FRAME_RATE/TB`;
                break;
            case 'freeze_zoom':
                filter = `loop=loop=${effect.duration * 30}:size=1,setpts=N/FRAME_RATE/TB,zoompan=z='min(zoom+0.005,${effect.zoom})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
            case 'brightness':
                filter = `eq=brightness=${effect.value}`;
                break;
            case 'crop':
                const cropWidth = Math.floor(width * parseFloat(effect.value));
                filter = `crop=${cropWidth}:${height}`;
                break;
            case 'crop_vertical':
                const cropHeight = Math.floor(height * parseFloat(effect.value));
                filter = `crop=${width}:${cropHeight}`;
                break;
            case 'mirror':
                filter = `hflip`;
                break;
            case 'slow':
                filter = `setpts=${effect.speed}*PTS`;
                break;
            case 'contrast':
                filter = `eq=contrast=${effect.value}`;
                break;
            case 'color':
            case 'color_temp':
            case 'hue':
                filter = effect.value;
                break;
            case 'saturation':
                filter = `eq=saturation=${effect.value}`;
                break;
            case 'reverse':
                filter = `reverse`;
                break;
            case 'cut':
                execSync(
                    `ffmpeg -y -f lavfi -i color=c=black:s=${width}x${height}:d=${effect.duration} -c:v libx264 -preset fast "${effectOutput}"`,
                    { stdio: 'pipe' }
                );
                effectFiles.push(effectOutput);
                continue;
            case 'normal':
                filter = 'null';
                break;
            default:
                filter = 'null';
        }
        
        const inputFile = i === 0 ? originalClip : effectFiles[i-1];
        
        if (filter !== 'null' && filter !== '') {
            try {
                execSync(
                    `ffmpeg -y -i "${inputFile}" -vf "${filter}" -c:v libx264 -preset fast -t ${effect.duration} "${effectOutput}"`,
                    { stdio: 'pipe' }
                );
            } catch (error) {
                console.log(`      ⚠️ فشل التأثير ${effect.type}، استخدام النسخة الأصلية`);
                execSync(
                    `ffmpeg -y -i "${inputFile}" -c copy -t ${effect.duration} "${effectOutput}"`,
                    { stdio: 'pipe' }
                );
            }
        } else if (filter === 'null') {
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

// دمج الفيديو مع الصوت
function mergeWithAudio(videoPath, audioPath, outputPath, targetDuration) {
    console.log("🎵 دمج الفيديو مع الصوت...");
    
    const videoDuration = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    ).toString());
    
    const speedFactor = videoDuration / targetDuration;
    
    if (Math.abs(speedFactor - 1) > 0.05) {
        console.log(`      ⚡ تعديل سرعة الفيديو بعامل ${speedFactor.toFixed(2)}`);
        
        const tempVideo = `temp/temp_speed.mp4`;
        
        execSync(
            `ffmpeg -y -i "${videoPath}" -filter:v "setpts=${speedFactor}*PTS" -an "${tempVideo}"`,
            { stdio: 'pipe' }
        );
        
        execSync(
            `ffmpeg -y -i "${tempVideo}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`,
            { stdio: 'pipe' }
        );
        
        try { fs.unlinkSync(tempVideo); } catch (e) {}
    } else {
        execSync(
            `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`,
            { stdio: 'pipe' }
        );
    }
    
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
    const scenes = parseScriptFile(scriptFile);
    console.log(`✅ تم العثور على ${scenes.length} مشهد`);
    
    // حساب المدة المتوقعة
    const videoDuration = scenes.length * 7.5;
    console.log(`⏱️ المدة المتوقعة للفيديو: ${videoDuration.toFixed(1)} ثانية`);
    
    // مدة الصوت
    const audioDuration = getAudioDuration(audioFile);
    console.log(`🎵 مدة ملف الصوت: ${audioDuration.toFixed(1)} ثانية`);
    
    if (Math.abs(videoDuration - audioDuration) > 1) {
        console.log(`⚠️ تحذير: المدة مختلفة، سيتم تعديل السرعة`);
    }
    
    // 1️⃣ تحميل الفيديو أولاً
    console.log("\n📥 المرحلة 1: تحميل الفيديو...");
    const downloadedVideo = "downloads/video.mp4";
    await downloadVideo(videoUrl, downloadedVideo);
    
    // 2️⃣ معالجة المشاهد
    console.log("\n🎬 المرحلة 2: معالجة المشاهد...");
    const sceneVideos = [];
    
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        console.log(`\n🎬 معالجة المشهد ${i + 1}/${scenes.length}`);
        console.log(`   ⏱️  ${Math.floor(scene.start/60)}:${Math.floor(scene.start%60).toString().padStart(2,'0')}`);
        console.log(`   📝 ${scene.text.substring(0, 50)}...`);
        
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
    
    // 4️⃣ دمج مع الصوت
    console.log("\n🎵 المرحلة 4: إضافة الصوت...");
    const timestamp = new Date().getTime();
    const finalVideo = `output/final_${timestamp}.mp4`;
    
    mergeWithAudio(concatedVideo, audioFile, finalVideo, audioDuration);
    
    // عرض النتيجة
    const stats = fs.statSync(finalVideo);
    console.log(`\n✅✅✅ تم بنجاح! ✅✅✅`);
    console.log(`   📁 الفيديو: ${finalVideo}`);
    console.log(`   📦 الحجم: ${(stats.size / (1024*1024)).toFixed(2)} MB`);
    
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
