import fs from 'fs';
import axios from 'axios';
import cheerio from 'cheerio';

async function scrapeSeries() {
  try {
    console.log('🚀 بدء استخراج المسلسلات...');
    
    // مثال: استخراج من موقع
    const { data } = await axios.get('https://example.com/series');
    const $ = cheerio.load(data);
    
    const series = [];
    
    // مثال: استخراج عناصر
    $('.series-item').each((index, element) => {
      const title = $(element).find('.title').text().trim();
      const episode = $(element).find('.episode').text().trim();
      const date = $(element).find('.date').text().trim();
      
      if (title) {
        series.push({ title, episode, date });
      }
    });
    
    // حفظ النتائج
    const report = {
      timestamp: new Date().toISOString(),
      total: series.length,
      series: series
    };
    
    fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
    console.log(`✅ تم استخراج ${series.length} مسلسل`);
    
    // حفظ بصيغة CSV أيضاً
    if (series.length > 0) {
      const csvContent = [
        'العنوان,الحلقة,التاريخ',
        ...series.map(s => `"${s.title}","${s.episode}","${s.date}"`)
      ].join('\n');
      
      fs.writeFileSync('series.csv', csvContent);
      console.log('📁 تم حفظ النتائج في report.json و series.csv');
    }
    
  } catch (error) {
    console.error('❌ خطأ في الاستخراج:', error.message);
    
    // حفظ الخطأ
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    fs.writeFileSync('error.json', JSON.stringify(errorReport, null, 2));
    process.exit(1);
  }
}

// تشغيل الدالة
scrapeSeries();
