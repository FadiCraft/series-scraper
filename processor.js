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

// ========== القوالب المطلوبة (بدون عشوائية) ==========
const templates = [
    // قالب 5: لقطة + تجميد + سرعة 1.2 + تجميد + سرعة 0.5
    { name: "قالب 5", effects: [
        { type: "normal_zoom", duration: 2.0 },     // لقطة بزوم 125% وسرعة 0.80
        { type: "freeze_smooth", duration: 1.0 },   // تجميد ناعم
        { type: "fast", speed: "1.2", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "slow", speed: "0.5", duration: 2.0, zoom: "1.25" }
    ]},
    
    // قالب 6: لقطة + قلب أفقي + تجميد + زوم خفيف
    { name: "قالب 6", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "mirror", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "zoom", value: "1.25", duration: 2.0, speed: "0.80" }
    ]},
    
    // قالب 7: لقطة بسرعة 0.75 + تجميد + عكس + طبيعي
    { name: "قالب 7", effects: [
        { type: "slow_zoom", speed: "0.75", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "reverse", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "normal_zoom", duration: 2.0 }
    ]},
    
    // قالب 8: لقطة + تجميد + اهتزاز + تجميد + زوم داخلي
    { name: "قالب 8", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "shake_light", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "zoom_in_smooth", value: "1.3", duration: 2.0, speed: "0.80" }
    ]},
    
    // قالب 9: لقطة + سرعة 0.5 + تجميد + سرعة 1.5
    { name: "قالب 9", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "slow", speed: "0.5", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "fast", speed: "1.5", duration: 2.0, zoom: "1.25" }
    ]},
    
    // قالب 10: لقطة + تجميد + عكس + تجميد + زوم خارجي
    { name: "قالب 10", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "reverse", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "zoom_out_smooth", value: "0.9", duration: 2.0, speed: "0.80" }
    ]},
    
    // قالب 11: لقطة + سطوع أعلى + تجميد + سرعة 0.75
    { name: "قالب 11", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "brightness", value: "0.15", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "slow", speed: "0.75", duration: 2.0, zoom: "1.25" }
    ]},
    
    // قالب 12: لقطة + تجميد + تحريك يمين + تجميد + تحريك يسار
    { name: "قالب 12", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "move_right_smooth", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "move_left_smooth", duration: 2.0, zoom: "1.25", speed: "0.80" }
    ]},
    
    // قالب 13: لقطة بسرعة 1.25 + تجميد + عكس بسرعة 0.75
    { name: "قالب 13", effects: [
        { type: "fast_zoom", speed: "1.25", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "reverse_slow", speed: "0.75", duration: 2.0, zoom: "1.25" }
    ]},
    
    // قالب 14: لقطة + blur خفيف + تجميد + طبيعي
    { name: "قالب 14", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "blur_light", value: "3", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "normal_zoom", duration: 2.0 }
    ]},
    
    // قالب 15: لقطة + تجميد + زوم داخلي + تجميد + قلب أفقي
    { name: "قالب 15", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "zoom_in_smooth", value: "1.3", duration: 2.0, speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "mirror", duration: 2.0, zoom: "1.25", speed: "0.80" }
    ]},
    
    // قالب 16: لقطة + سرعة 0.5 + عكس + تجميد
    { name: "قالب 16", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "slow", speed: "0.5", duration: 2.0, zoom: "1.25" },
        { type: "reverse", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 }
    ]},
    
    // قالب 17: لقطة + تجميد + زوم مع تحريك للأعلى
    { name: "قالب 17", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "zoom_up_smooth", value: "1.25", duration: 2.0, speed: "0.80" }
    ]},
    
    // قالب 18: لقطة + سرعة 1.3 + تجميد + عكس مع زوم
    { name: "قالب 18", effects: [
        { type: "fast_zoom", speed: "1.3", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "reverse_zoom_smooth", value: "1.2", duration: 2.0, speed: "0.80" }
    ]},
    
    // قالب 19: لقطة + تجميد + تباين عالي + تجميد
    { name: "قالب 19", effects: [
        { type: "normal_zoom", duration: 2.0 },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "contrast", value: "1.3", duration: 2.0, zoom: "1.25", speed: "0.80" },
        { type: "freeze_smooth", duration: 1.0 }
    ]},
    
    // قالب 20: لقطة + سرعة 0.75 + تجميد + اهتزاز خفيف
    { name: "قالب 20", effects: [
        { type: "slow_zoom", speed: "0.75", duration: 2.0, zoom: "1.25" },
        { type: "freeze_smooth", duration: 1.0 },
        { type: "shake_very_light", duration: 2.0, zoom: "1.25", speed: "0.80" }
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

// تطبيق قالب على مقطع (بدون عشوائية - نستخدم القوالب بالترتيب)
async function applyTemplate(videoPath, startTime, sceneIndex, templateIndex, outputPath) {
    const template = templates[templateIndex % templates.length];
    console.log(`   🎨 تطبيق ${template.name} على المشهد ${sceneIndex + 1}`);
    
    // قص المقطع الأصلي (2 ثانية) مع الحفاظ على الجودة
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
        let baseZoom = effect.zoom || "1.25"; // الزوم الافتراضي 125%
        let baseSpeed = effect.speed || "0.80"; // السرعة الافتراضية 0.80
        
        switch(effect.type) {
            case 'normal_zoom': // لقطة بزوم 125% وسرعة 0.80
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'slow_zoom': // لقطة بطيئة مع زوم
                filter = `setpts=${effect.speed || baseSpeed}*PTS,zoompan=z='${effect.zoom || baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'fast_zoom': // لقطة سريعة مع زوم
                filter = `setpts=${effect.speed || baseSpeed}*PTS,zoompan=z='${effect.zoom || baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'freeze_smooth': // تجميد ناعم مع انتقال
                filter = `loop=loop=${effect.duration * 30}:size=1,setpts=N/FRAME_RATE/TB,zoompan=z='1.25':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'zoom': // زوم عادي
            case 'zoom_in_smooth': // زوم داخلي ناعم
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='min(zoom+0.02,${effect.value || "1.3"})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'zoom_out_smooth': // زوم خارجي ناعم
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='max(zoom-0.02,${effect.value || "0.9"})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'reverse': // عكس مع زوم وسرعة
                filter = `setpts=${baseSpeed}*PTS,reverse,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'reverse_slow': // عكس بطيء
                filter = `setpts=${effect.speed || "0.75"}*PTS,reverse,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'reverse_zoom_smooth': // عكس مع زوم ناعم
                filter = `setpts=${baseSpeed}*PTS,reverse,zoompan=z='min(zoom+0.02,${effect.value || "1.2"})':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'zoom_up_smooth': // زوم مع تحريك للأعلى
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='min(zoom+0.02,${effect.value || "1.25"})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-10':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'mirror': // قلب أفقي
                filter = `setpts=${baseSpeed}*PTS,hflip,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'brightness': // سطوع
                filter = `setpts=${baseSpeed}*PTS,eq=brightness=${effect.value || "0.15"},zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'contrast': // تباين
                filter = `setpts=${baseSpeed}*PTS,eq=contrast=${effect.value || "1.3"},zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'blur_light': // Blur خفيف
                filter = `setpts=${baseSpeed}*PTS,boxblur=${effect.value || "3"}:1,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'shake_light': // اهتزاز خفيف
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height},shake=1.0:2:5`;
                break;
                
            case 'shake_very_light': // اهتزاز خفيف جداً
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height},shake=0.5:1:3`;
                break;
                
            case 'move_right_smooth': // تحريك يمين ناعم
                filter = `setpts=${baseSpeed}*PTS,pad=iw+100:ih:ow-100:0,zoompan=z='${baseZoom}':x='min(100,on)*1.5':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'move_left_smooth': // تحريك يسار ناعم
                filter = `setpts=${baseSpeed}*PTS,pad=iw+100:ih:0:0,zoompan=z='${baseZoom}':x='max(0,100-on)*1.5':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'slow': // سرعة بطيئة
                filter = `setpts=${effect.speed || baseSpeed}*PTS,zoompan=z='${effect.zoom || baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            case 'fast': // سرعة سريعة
                filter = `setpts=${effect.speed || baseSpeed}*PTS,zoompan=z='${effect.zoom || baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
                break;
                
            default:
                filter = `setpts=${baseSpeed}*PTS,zoompan=z='${baseZoom}':d=${effect.duration * 30}:fps=30:s=${width}x${height}`;
        }
        
        const inputFile = i === 0 ? originalClip : effectFiles[i-1];
        
        // تطبيق التأثير مع الحفاظ على الجودة (استخدام slower للحصول على جودة أفضل)
        try {
            execSync(
                `ffmpeg -y -i "${inputFile}" -vf "${filter}" -c:v libx264 -preset slower -crf 18 -t ${effect.duration} "${effectOutput}"`,
                { stdio: 'pipe' }
            );
        } catch (error) {
            // إذا فشل، نستخدم نسخة احتياطية بسيطة
            execSync(
                `ffmpeg -y -i "${inputFile}" -vf "setpts=0.8*PTS,zoompan=z='1.25':d=${effect.duration * 30}:fps=30" -c:v libx264 -preset medium -t ${effect.duration} "${effectOutput}"`,
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

// دمج الفيديو مع الصوت مع موازنة المستوى
function mergeWithAudio(videoPath, audioPath, outputPath) {
    console.log("🎵 دمج الفيديو مع الصوت...");
    
    // نستخدم filter لموازنة الصوت (لا يكون مرتفع جداً)
    execSync(
        `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest -af "volume=0.9" "${outputPath}"`,
        { stdio: 'pipe' }
    );
    
    return outputPath;
}

// إضافة تأثيرات بسيطة للانتقالات بين المشاهد
function addSmoothTransitions(inputVideo, outputVideo) {
    console.log("🔄 إضافة انتقالات ناعمة بين المشاهد...");
    
    // نضيف fade in/out بسيط للفيديو كامل
    execSync(
        `ffmpeg -y -i "${inputVideo}" -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=${getVideoDuration(inputVideo)-0.5}:d=0.5" -c:a copy "${outputVideo}"`,
        { stdio: 'pipe' }
    );
    
    return outputVideo;
}

// الحصول على مدة الفيديو
function getVideoDuration(videoPath) {
    try {
        const output = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        ).toString();
        return parseFloat(output);
    } catch (error) {
        return 0;
    }
}

// ============= الوظيفة الرئيسية =============
async function main() {
    console.log("🚀 بدء مشروع ملخص الأفلام التلقائي (بجودة عالية ومناسبة لليوتيوب)");
    console.log("=".repeat(60));
    
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
    
    // 2️⃣ معالجة المشاهد (باستخدام القوالب بالترتيب - بدون عشوائية)
    console.log("\n🎬 المرحلة 2: معالجة المشاهد...");
    const sceneVideos = [];
    
    for (let i = 0; i < selectedScenes.length; i++) {
        const scene = selectedScenes[i];
        console.log(`\n🎬 معالجة المشهد ${i + 1}/${selectedScenes.length}`);
        console.log(`   ⏱️  ${Math.floor(scene.start/60)}:${Math.floor(scene.start%60).toString().padStart(2,'0')}`);
        console.log(`   📝 ${scene.text.substring(0, 50)}${scene.text.length > 50 ? '...' : ''}`);
        
        const finalScenePath = `temp/scene_${i}_final.mp4`;
        // نستخدم i كـ template index لتكرار القوالب بالترتيب
        await applyTemplate(downloadedVideo, scene.start, i, i, finalScenePath);
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
    
    // 4️⃣ إضافة انتقالات ناعمة
    console.log("\n✨ المرحلة 4: إضافة انتقالات ناعمة...");
    const videoWithTransitions = `temp/with_transitions.mp4`;
    addSmoothTransitions(concatedVideo, videoWithTransitions);
    
    // 5️⃣ إضافة الصوت
    console.log("\n🎵 المرحلة 5: إضافة الصوت...");
    const timestamp = new Date().getTime();
    const finalVideo = `output/final_${timestamp}.mp4`;
    
    mergeWithAudio(videoWithTransitions, audioFile, finalVideo);
    
    // عرض النتيجة
    const stats = fs.statSync(finalVideo);
    const finalDuration = getVideoDuration(finalVideo);
    
    console.log(`\n✅✅✅ تم بنجاح! ✅✅✅`);
    console.log(`   📁 الفيديو: ${finalVideo}`);
    console.log(`   📦 الحجم: ${(stats.size / (1024*1024)).toFixed(2)} MB`);
    console.log(`   ⏱️  المدة: ${finalDuration.toFixed(1)} ثانية`);
    console.log(`   🎬 المشاهد: ${selectedScenes.length}`);
    console.log(`   🎨 القوالب: ${templates.length} قالب (تطبيق دوري)`);
    console.log(`   ✨ جميع اللقطات: زوم 125% + سرعة 0.80 (لطيف للمشاهد)`);
    
    // تنظيف
    console.log("\n🧹 تنظيف الملفات المؤقتة...");
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
    
    console.log("\n✨ انتهى! الفيديو جاهز للاستخدام العادل على يوتيوب");
}

if (require.main === module) {
    main().catch(error => {
        console.error("❌ خطأ:", error);
        process.exit(1);
    });
}
