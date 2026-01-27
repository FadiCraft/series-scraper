// استخدم require بدل import
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeSeries() {
  try {
    console.log('🚀 بدء استخراج المسلسلات...');
    
    // الموقع الحقيقي الذي تريد استخراج منه
    const { data } = await axios.get('https://shahid.mbc.net/ar/channels/mbc-iraq', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const series = [];
    
    // استخراج المسلسلات (عدل حسب هيكل الموقع)
    $('.program-card, .show-item, .series-item').each((index, element) => {
      const title = $(element).find('.title, h3, .name').text().trim();
      const time = $(element).find('.time, .schedule-time').text().trim();
      const episode = $(element).find('.episode, .ep').text().trim();
      
      if (title && title.length > 2) {
        series.push({
          title,
          time: time || 'غير محدد',
          episode: episode || 'الحلقة الحالية',
          date: new Date().toLocaleDateString('ar-SA')
        });
      }
    });
    
    // إذا لم تجد شيء، جرب طريقة أخرى
    if (series.length === 0) {
      $('h2, h3').each((index, element) => {
        const text = $(element).text().trim();
        if (text.includes('مسلسل') || text.length > 5) {
          series.push({
            title: text,
            time: 'غير محدد',
            episode: 'الحلقة الحالية',
            date: new Date().toLocaleDateString('ar-SA')
          });
        }
      });
    }
    
    // حفظ النتائج
    const report = {
      timestamp: new Date().toISOString(),
      total: series.length,
      series: series.slice(0, 20) // أول 20 مسلسل فقط
    };
    
    fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
    console.log(`✅ تم استخراج ${series.length} مسلسل`);
    
    // حفظ CSV
    if (series.length > 0) {
      const csvContent = [
        'العنوان,الوقت,الحلقة,التاريخ',
        ...series.map(s => `"${s.title}","${s.time}","${s.episode}","${s.date}"`)
      ].join('\n');
      
      fs.writeFileSync('series.csv', csvContent);
      console.log('📁 تم حفظ النتائج في report.json و series.csv');
    }
    
    return series.length;
    
  } catch (error) {
    console.error('❌ خطأ في الاستخراج:', error.message);
    
    // حفظ خطأ بسيط
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message
    };
    
    fs.writeFileSync('error.json', JSON.stringify(errorReport, null, 2));
    throw error; // رمي الخطأ لتوقيف الـ workflow
  }
}

// تشغيل إذا تم استدعاء الملف مباشرة
if (require.main === module) {
  scrapeSeries().catch(error => {
    console.error('فشل التشغيل:', error);
    process.exit(1);
  });
}

module.exports = { scrapeSeries }; // للاستيراد لو احتجته
