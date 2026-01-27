const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

console.log("🚀 بدء البرنامج...");
console.log("📦 الحزم المثبتة:");
console.log("- axios:", require('axios/package.json').version);
console.log("- cheerio:", require('cheerio/package.json').version);

// اختبار بسيط
async function test() {
  try {
    console.log("🔍 اختبار الاتصال...");
    
    // طلب بسيط
    const response = await axios.get('https://httpbin.org/html', {
      timeout: 10000
    });
    
    console.log("✅ الاتصال ناجح، الحالة:", response.status);
    
    // اختبار cheerio
    const $ = cheerio.load(response.data);
    const title = $('h1').text() || 'لا يوجد عنوان';
    
    console.log("📝 العنوان المستخرج:", title);
    
    // حفظ النتيجة
    const result = {
      success: true,
      status: response.status,
      title: title,
      timestamp: new Date().toISOString(),
      packages: {
        axios: require('axios/package.json').version,
        cheerio: require('cheerio/package.json').version
      }
    };
    
    fs.writeFileSync('test.json', JSON.stringify(result, null, 2));
    console.log("💾 تم حفظ test.json");
    
  } catch (error) {
    console.error("❌ خطأ:", error.message);
    
    const errorResult = {
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('error.json', JSON.stringify(errorResult, null, 2));
    console.log("💾 تم حفظ error.json");
  }
}

test();
