const https = require('https');
const ids = ['INK_SACK', 'INK_SACK:3', 'ENCHANTED_COCOA', 'DOUBLE_PLANT', 'DOUBLE_PLANT:0'];
for (const id of ids) {
  https.get(`https://sky.coflnet.com/static/icon/${id}`, (res) => {
    console.log(`${id}: ${res.statusCode}`);
  });
}
