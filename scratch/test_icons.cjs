const https = require('https');
const ids = ['WHEAT', 'CARROT_ITEM', 'POTATO_ITEM', 'PUMPKIN', 'MELON', 'BROWN_MUSHROOM', 'RED_MUSHROOM', 'COCOA_BEANS', 'CACTUS', 'SUGAR_CANE', 'NETHER_STALK', 'WILD_ROSE', 'MOONFLOWER', 'SUNFLOWER'];
for (const id of ids) {
  https.get(`https://sky.coflnet.com/static/icon/${id}`, (res) => {
    console.log(`${id}: ${res.statusCode}`);
  });
}
