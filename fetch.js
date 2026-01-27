const fs = require('fs');
const https = require('https');

console.log('🔍 اختبار الاتصال المباشر بدون axios...');

// اختبار اتصال مباشر بـ Node.js
const options = {
  hostname: 'httpbin.org',
  port: 443,
  path: '/ip',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js Test'
  }
};

const req = https.request(options, (res) => {
  console.log('📊 حالة HTTP:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ اتصال ناجح!');
      console.log('🌐 IP الخاص بك:', result.origin);
      
      fs.writeFileSync('connection_test.json', JSON.stringify({
        success: true,
        status: res.statusCode,
        your_ip: result.origin,
        timestamp: new Date().toISOString()
      }, null, 2));
      
    } catch (e) {
      console.error('خطأ في تحويل JSON:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ فشل الاتصال:', error.message);
  
  fs.writeFileSync('connection_error.json', JSON.stringify({
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString()
  }, null, 2));
});

req.setTimeout(10000, () => {
  console.error('⏰ انتهى وقت الانتظار');
  req.destroy();
});

req.end();
