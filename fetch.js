const fs = require('fs');

console.log('✅ بدء البرنامج...');

const data = {
  message: 'هذا اختبار',
  timestamp: new Date().toISOString(),
  status: 'success'
};

fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
console.log('📝 تم إنشاء test.json بنجاح!');
