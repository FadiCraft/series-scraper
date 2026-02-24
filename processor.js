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

// تحميل الفيديو من رابط مباشر
async function downloadFromUrl(url, outputPath) {
  console.log(`📥 تحميل الفيديو من: ${url}`);
  
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be') || 
        url.includes('facebook.com') || url.includes('twitter.com') || 
        url.includes('tiktok.com') || url.includes('instagram.com')) {
      
      console.log("🔄 استخدام youtube-dl لتحميل من المنصة...");
      await youtubedl(url, {
        output: outputPath,
        format: 'mp4',
        noCheckCertificate: true
      });
      
    } else {
      console.log("🔄 تحميل من رابط مباشر...");
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
    }
    
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log(`✅ تم التحميل بنجاح: ${outputPath}`);
      return outputPath;
    } else {
      throw new Error("الملف فارغ أو لم يتم تحميله");
    }
    
  } catch (error) {
    console.error("❌ خطأ في التحميل:", error.message);
    
    try {
      console.log("🔄 محاولة بديلة باستخدام FFmpeg...");
      execSync(`ffmpeg -y -i "${url}" -c copy ${outputPath}`, { 
        stdio: 'inherit',
        timeout: 300000 
      });
      return outputPath;
    } catch (ffmpegError) {
      throw new Error(`فشل تحميل الفيديو: ${error.message}`);
    }
  }
}

// قراءة ملف النص (للمشاهد فقط، تم إزالة الصوت)
function parseScriptFile(scriptPath) {
  const content = fs.readFileSync(scriptPath, "utf8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  
  const scenes = [];
  
  for (const line of lines) {
    const match = line.match(/(\d+:\d+)-(\d+:\d+)\s*\|\s*(.+)/);
    
    if (match) {
      const startTime = timeToSeconds(match[1]);
      const endTime = timeToSeconds(match[2]);
      const description = match[3]; // وصف المشهد (قد يُستخدم لاحقاً)
      
      scenes.push({
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        text: description
      });
    }
  }
  
  return scenes;
}

// تحويل الوقت من صيغة دقائق:ثواني إلى ثواني
function timeToSeconds(timeStr) {
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseInt(timeStr);
}

// ========== تم إزالة دالة توليد الصوت بالكامل ==========

// ========== تطبيق الاستراتيجيات البصرية (المونتاج التحويلي) ==========
function applyVisualTransformations(inputVideo, start, duration, sceneIndex, outputPath) {
  console.log(`🎬 تطبيق مؤثرات بصرية على المشهد ${sceneIndex}...`);

  // 1. قاعدة الـ 3 ثوانٍ المتقطعة: سنقسم كل مشهد إلى مقاطع قصيرة (2-3 ثوانٍ)
  // 2. التلاعب بالإطار (Reframing): Zoom In/Out عشوائي
  // 3. تراكب العناصر (Overlays): إضافة نص توضيحي (مثل "المشهد الرئيسي")
  // 4. تغيير الألوان: تعديل بسيط في درجة السطوع والتباين

  // فكرة العمل: بدلاً من قص مشهد واحد طويل، نقوم بقصه إلى عدة مقاطع صغيرة جداً
  // ونطبق على كل مقطع تأثيرات مختلفة.
  
  // سنقوم بتقسيم المشهد إلى 3-5 مقاطع صغيرة (2-4 ثوانٍ لكل منها)
  const subClipCount = Math.min(5, Math.max(3, Math.floor(duration / 3))); // بين 3 و 5 مقاطع
  const subClipDuration = duration / subClipCount;
  
  const tempFiles = [];
  
  for (let i = 0; i < subClipCount; i++) {
    const subStart = start + (i * subClipDuration);
    const subDur = subClipDuration;
    const tempClip = `temp/scene_${sceneIndex}_part_${i}.mp4`;
    
    // قص المقطع الصغير
    execSync(
      `ffmpeg -y -ss ${subStart} -t ${subDur} -i "${inputVideo}" ` +
      `-c copy -an ${tempClip}` // -an لإزالة الصوت الأصلي
    );
    
    // تطبيق تأثيرات بصرية مختلفة على كل مقطع
    const transformedClip = `temp/scene_${sceneIndex}_part_${i}_transformed.mp4`;
    
    // نختار تأثيراً عشوائياً لكل مقطع
    const effectType = i % 3; // 0,1,2 لتوزيع التأثيرات
    
    let filterComplex = '';
    
    if (effectType === 0) {
      // تأثير Zoom In بسيط
      filterComplex = '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z=\'min(zoom+0.0015,1.2)\':d=125:fps=30[out]';
    } else if (effectType === 1) {
      // تأثير قص الأطراف + تغيير السطوع
      filterComplex = '[0:v]crop=iw-100:ih-100:50:50,scale=1920:1080,eq=brightness=0.05:contrast=1.1[out]';
    } else {
      // تأثير عكس الصورة (Mirroring) أفقي مع تراكب نص
      filterComplex = '[0:v]hflip,drawtext=fontfile=/path/to/arial.ttf:text=\'مشهد حصري\':fontcolor=white:fontsize=24:x=10:y=10,eq=saturation=1.2[out]';
    }
    
    try {
      execSync(
        `ffmpeg -y -i "${tempClip}" -filter_complex "${filterComplex}" -map "[out]" -c:v libx264 -preset fast ${transformedClip}`,
        { stdio: 'pipe' }
      );
    } catch (filterError) {
      // إذا فشل التأثير المعقد، نستخدم تأثيراً بسيطاً
      console.log(`⚠️ فشل التأثير المتقدم، استخدام تأثير بسيط للمقطع ${i}`);
      execSync(
        `ffmpeg -y -i "${tempClip}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" -c:v libx264 -preset fast ${transformedClip}`
      );
    }
    
    tempFiles.push(transformedClip);
  }
  
  // دمج المقاطع الصغيرة بعد تطبيق التأثيرات
  const listFile = `temp/scene_${sceneIndex}_list.txt`;
  const content = tempFiles.map(f => `file '${path.resolve(f)}'`).join("\n");
  fs.writeFileSync(listFile, content);
  
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`
  );
  
  // تنظيف الملفات المؤقتة لهذا المشهد
  tempFiles.forEach(f => {
    try { fs.unlinkSync(f); } catch (e) {}
  });
  try { fs.unlinkSync(listFile); } catch (e) {}
  
  return outputPath;
}

// دالة جديدة لإضافة موسيقى خلفية هادئة
function addBackgroundMusic(videoPath, outputPath) {
  console.log("🎵 إضافة موسيقى خلفية...");
  
  // التحقق من وجود ملف الموسيقى
  const musicPath = 'background_music.mp3';
  
  if (!fs.existsSync(musicPath)) {
    console.log("⚠️ لم يتم العثور على ملف موسيقى، تخطي الخطوة...");
    // نسخ الفيديو بدون موسيقى
    execSync(`ffmpeg -y -i "${videoPath}" -c copy "${outputPath}"`);
    return outputPath;
  }
  
  // الحصول على مدة الفيديو
  const durationOutput = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
  ).toString();
  const videoDuration = parseFloat(durationOutput);
  
  // إضافة الموسيقى مع خفض صوتها وحلقة إذا كانت أقصر من الفيديو
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${musicPath}" ` +
    `-filter_complex "[1:a]aloop=loop=-1:size=2e+09,atrim=duration=${videoDuration},volume=0.3[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[a]" ` +
    `-map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${outputPath}"`,
    { stdio: 'pipe' }
  );
  
  return outputPath;
}

// دمج جميع المقاطع (مع تعديل بسيط)
function concatVideos(videoList, outputPath) {
  console.log("🔗 دمج جميع المشاهد...");
  
  const listFile = "temp/concat_list.txt";
  const content = videoList.map(v => `file '${path.resolve(v)}'`).join("\n");
  fs.writeFileSync(listFile, content);
  
  // دمج الفيديو بدون صوت (لأنه تمت إزالة الصوت من جميع المقاطع)
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy -an "${outputPath}"` // -an لإزالة أي أثر للصوت
  );
  
  return outputPath;
}

// الحصول على معلومات الفيديو
function getVideoInfo(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "${videoPath}"`
    ).toString();
    
    const lines = output.split('\n');
    const info = {};
    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) info[key] = value;
    });
    
    return {
      duration: parseFloat(info.duration) || 0,
      size: parseInt(info.size) || 0
    };
  } catch (error) {
    return { duration: 0, size: 0 };
  }
}

// تنظيف الملفات المؤقتة
function cleanup() {
  console.log("🧹 تنظيف الملفات المؤقتة...");
  
  try {
    const tempDir = 'temp';
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        if (file.endsWith('.mp4') || file.endsWith('.txt') || file.endsWith('.mp3')) {
          try { fs.unlinkSync(path.join(tempDir, file)); } catch (e) {}
        }
      });
    }
  } catch (error) {
    console.log("⚠️ خطأ في تنظيف الملفات المؤقتة:", error.message);
  }
}

// ============= الوظيفة الرئيسية المعدلة بالكامل =============
async function main() {
  console.log("🚀 بدء مشروع ملخص الأفلام التلقائي (بدون صوت)");
  console.log("=".repeat(50));
  
  const videoSource = process.argv[2];
  const scriptFile = process.argv[3] || "script.txt";
  
  if (!videoSource) {
    console.error("❌ الرجاء تحديد مصدر الفيديو (رابط أو مسار ملف)");
    console.log("📌 مثال: node Molahas.js https://example.com/video.mp4 script.txt");
    console.log("📌 مثال: node Molahas.js movie.mp4 script.txt");
    process.exit(1);
  }
  
  if (!fs.existsSync(scriptFile)) {
    console.error(`❌ ملف النص ${scriptFile} غير موجود`);
    console.log("📝 مثال لمحتوى الملف:");
    console.log("00:00-01:30 | مشهد البطل في الغابة");
    console.log("01:30-03:00 | الهجوم على القرية");
    process.exit(1);
  }
  
  let videoPath;
  let isUrl = videoSource.startsWith('http://') || videoSource.startsWith('https://');
  
  if (isUrl) {
    console.log(`🌐 المصدر: رابط (${videoSource.substring(0, 100)}...)`);
    videoPath = "downloads/downloaded_video.mp4";
    
    try {
      await downloadFromUrl(videoSource, videoPath);
    } catch (error) {
      console.error("❌ فشل تحميل الفيديو:", error.message);
      process.exit(1);
    }
  } else {
    console.log(`📁 المصدر: ملف محلي (${videoSource})`);
    if (!fs.existsSync(videoSource)) {
      console.error(`❌ الملف ${videoSource} غير موجود`);
      process.exit(1);
    }
    videoPath = videoSource;
  }
  
  const videoInfo = getVideoInfo(videoPath);
  const durationMinutes = Math.floor(videoInfo.duration / 60);
  const durationSeconds = Math.floor(videoInfo.duration % 60);
  console.log(`📊 معلومات الفيديو:`);
  console.log(`   - المدة: ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`);
  console.log(`   - الحجم: ${(videoInfo.size / (1024*1024)).toFixed(2)} MB`);
  
  console.log(`\n📄 قراءة ملف النص: ${scriptFile}`);
  const scenes = parseScriptFile(scriptFile);
  console.log(`✅ تم العثور على ${scenes.length} مشهد`);
  
  const validScenes = scenes.filter(scene => scene.end <= videoInfo.duration);
  if (validScenes.length < scenes.length) {
    console.log(`⚠️ تم تجاهل ${scenes.length - validScenes.length} مشهد يتجاوز مدة الفيديو`);
  }
  
  if (validScenes.length === 0) {
    console.error("❌ لا يوجد مشاهد صالحة في ملف النص");
    process.exit(1);
  }
  
  const sceneVideos = [];
  
  for (let i = 0; i < validScenes.length; i++) {
    const scene = validScenes[i];
    console.log(`\n🎬 معالجة المشهد ${i + 1}/${validScenes.length}`);
    console.log(`   ⏱️  ${Math.floor(scene.start/60)}:${Math.floor(scene.start%60).toString().padStart(2,'0')} - ${Math.floor(scene.end/60)}:${Math.floor(scene.end%60).toString().padStart(2,'0')}`);
    console.log(`   📝 ${scene.text.substring(0, 100)}${scene.text.length > 100 ? '...' : ''}`);
    
    // ===== الخطوات المعدلة: بدون صوت، فقط مؤثرات بصرية =====
    const finalScenePath = `temp/scene_${i}_final.mp4`;
    
    // تطبيق التحويلات البصرية مباشرة
    applyVisualTransformations(videoPath, scene.start, scene.duration, i, finalScenePath);
    
    sceneVideos.push(finalScenePath);
  }
  
  console.log("\n🔗 دمج جميع المشاهد...");
  const concatedVideo = `temp/concated_video.mp4`;
  concatVideos(sceneVideos, concatedVideo);
  
  // إضافة موسيقى خلفية (اختياري)
  console.log("\n🎵 إضافة موسيقى خلفية هادئة...");
  const timestamp = new Date().getTime();
  const finalVideoWithMusic = `output/final_summary_${timestamp}.mp4`;
  addBackgroundMusic(concatedVideo, finalVideoWithMusic);
  
  const finalInfo = getVideoInfo(finalVideoWithMusic);
  const finalMinutes = Math.floor(finalInfo.duration / 60);
  const finalSeconds = Math.floor(finalInfo.duration % 60);
  console.log(`\n✅ تم إنشاء الفيديو النهائي:`);
  console.log(`   📁 المسار: ${finalVideoWithMusic}`);
  console.log(`   ⏱️  المدة: ${finalMinutes}:${finalSeconds.toString().padStart(2, '0')}`);
  console.log(`   📦 الحجم: ${(finalInfo.size / (1024*1024)).toFixed(2)} MB`);
  console.log(`   🎬 عدد المشاهد: ${validScenes.length}`);
  console.log(`   🔇 ملاحظة: الفيديو بدون تعليق صوتي (ممتثل للشرط الأول)`);
  
  cleanup();
  
  console.log("\n✨ انتهى العمل بنجاح!");
}

if (require.main === module) {
  main().catch(error => {
    console.error("❌ خطأ غير متوقع:", error);
    process.exit(1);
  });
}

module.exports = {
  downloadFromUrl,
  parseScriptFile,
  timeToSeconds,
  applyVisualTransformations,
  addBackgroundMusic,
  concatVideos,
  getVideoInfo,
  cleanup,
  main
};
