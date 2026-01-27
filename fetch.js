import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 إعادة تعيين مستخرج المسلسلات...');

// حذف الملفات
const filesToDelete = ['progress.json', 'report.json', 'error.json'];
filesToDelete.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ تم حذف: ${file}`);
    }
});

// إعادة تعيين الفهرس
const indexPath = path.join(__dirname, 'series', 'index.json');
if (fs.existsSync(indexPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        data.pages = {};
        data.stats.totalPages = 0;
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
        console.log('✅ تم تحديث الفهرس');
    } catch (error) {
        console.log('⚠️ لا يمكن تحديث الفهرس');
    }
}

// حذف مجلد الحلقات (اختياري)
const episodesPath = path.join(__dirname, 'episodes');
if (fs.existsSync(episodesPath)) {
    fs.rmSync(episodesPath, { recursive: true });
    fs.mkdirSync(episodesPath, { recursive: true });
    console.log('🗑️ تم إعادة تعيين مجلد الحلقات');
}

console.log('🎯 تمت إعادة التعيين. البرنامج سيبدأ من الصفحة 1');
