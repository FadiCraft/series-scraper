const fs = require('fs');
const axios = require('axios');

async function simpleScrape() {
  console.log('🔍 جاري الاستخراج...');
  
  try {
    // طلب بسيط للتأكد من أن axios يعمل
    const response = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    
    const data = {
      timestamp: new Date().toISOString(),
      test: 'نجح الاتصال',
      response: response.data
    };
    
    fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
    console.log('✅ تمت العملية بنجاح، راجع test.json');
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    fs.writeFileSync('error.json', JSON.stringify({ error: error.message }, null, 2));
  }
}

simpleScrape();
