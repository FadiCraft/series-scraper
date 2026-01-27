const fs = require('fs');

console.log("✅ بدأ البرنامج...");
console.log("📦 تحقق من axios:");

try {
  // محاولة تحميل axios
  const axios = require('axios');
  console.log("✅ axios مثبت بنجاح!");
  
  // اختبار بسيط
  const testData = {
    success: true,
    message: "axios يعمل بشكل صحيح",
    version: require('./node_modules/axios/package.json').version,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('test.json', JSON.stringify(testData, null, 2));
  console.log("📝 تم حفظ test.json");
  
} catch (error) {
  console.error("❌ فشل تحميل axios:", error.message);
  
  const errorData = {
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    files: {
      node_modules_exists: fs.existsSync('node_modules'),
      axios_exists: fs.existsSync('node_modules/axios'),
      package_json_exists: fs.existsSync('package.json')
    }
  };
  
  fs.writeFileSync('error.json', JSON.stringify(errorData, null, 2));
  console.log("📝 تم حفظ error.json مع تفاصيل الخطأ");
}
