
const fs = require('fs');

async function test() {
  try {
    const productsResponse = await fetch('http://localhost:3000/api/bazaar');
    const productsData = await productsResponse.json();
    const productMap = new Map(Object.values(productsData.products).map(p => [p.product_id, p]));

    const fusionData = JSON.parse(fs.readFileSync('/Users/william/Desktop/shard bot/SkyShards-master/public/fusion-data.json', 'utf8'));

    const results = [];
    const buyStrategy = 'insta';
    const sellStrategy = 'order';

    for (const [targetItem, recipesByCost] of Object.entries(fusionData.recipes)) {
      const targetShard = fusionData.shards[targetItem];
      if (!targetShard) continue;
      const targetProd = productMap.get(targetShard.internal_id);
      if (!targetProd) continue;

      for (const [qtyStr, recipes] of Object.entries(recipesByCost)) {
        const outputQuantity = parseInt(qtyStr);
        for (const recipe of recipes) {
          let totalCost = 0;
          let validRecipe = true;
          for (const ingredient of recipe) {
            const ingShard = fusionData.shards[ingredient];
            if (!ingShard) { validRecipe = false; break; }
            const prod = productMap.get(ingShard.internal_id);
            if (!prod) { validRecipe = false; break; }
            const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
            totalCost += (price * ingShard.fuse_amount);
          }
          if (!validRecipe) continue;

          let unitRevenue = sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice;
          unitRevenue = unitRevenue * 0.9875;
          const totalRevenue = unitRevenue * outputQuantity;
          const totalProfit = totalRevenue - totalCost;
          const profitPerShard = totalProfit / outputQuantity;
          
          results.push({
            name: targetShard.name,
            profitPerShard,
            totalCost,
            outputQuantity,
            revenuePerShard: unitRevenue
          });
        }
      }
    }

    results.sort((a, b) => b.profitPerShard - a.profitPerShard);
    console.log('Top 10 Flips (Profit Per Shard):');
    results.slice(0, 10).forEach((r, i) => {
      console.log(`${i+1}. ${r.name} | ${Math.round(r.profitPerShard).toLocaleString()}/shard (Cost: ${Math.round(r.totalCost).toLocaleString()} | Rev/Shard: ${Math.round(r.revenuePerShard).toLocaleString()}) | Yield: ${r.outputQuantity}`);
    });
  } catch (err) {
    console.error(err);
  }
}

test();
