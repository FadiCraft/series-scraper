const fs = require('fs');
const axios = require('axios');

async function testAxios() {
  try {
    console.log('🔍 اختبار اتصال axios...');
    
    // استخدم موقع أبسط للتأكد من الاتصال
    const response = await axios.get('https://httpbin.org/get', {
      timeout: 10000, // 10 ثواني
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('📊 حالة الرد:', response.status);
    
    const data = {
      status: response.status,
      url: response.config.url,
      message: 'تم الاتصال بنجاح',
      timestamp: new Date().toISOString(),
      ip: response.data.origin || 'غير معروف'
    };
    
    fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
    console.log('✅ نجاح! تم حفظ البيانات في test.json');
    
    // عرض جزء من البيانات
    console.log('📝 البيانات:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error('🔧 تفاصيل الخطأ:', error.code || 'لا يوجد كود');
    
    const errorData = { 
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      config: {
        url: error.config?.url,
        method: error.config?.method
      }
    };
    
    fs.writeFileSync('error.json', JSON.stringify(errorData, null, 2));
    console.log('📁 تم حفظ تفاصيل الخطأ في error.json');
  }
}

testAxios();
