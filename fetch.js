const fs = require('fs');
const axios = require('axios');

async function testAxios() {
  try {
    console.log('🔍 اختبار اتصال axios...');
    
    const response = await axios.get('https://api.github.com');
    
    const data = {
      status: response.status,
      message: 'تم الاتصال بنجاح',
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
    console.log('✅ نجاح! راجع test.json');
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    fs.writeFileSync('error.json', JSON.stringify({ 
      error: error.message 
    }, null, 2));
  }
}

testAxios();
