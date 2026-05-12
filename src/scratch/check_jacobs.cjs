
const axios = require('axios');

async function checkJacobs() {
  try {
    const response = await axios.get('https://jacobs.strassburger.dev/api/jacobcontests');
    console.log(JSON.stringify(response.data.slice(0, 5), null, 2));
  } catch (err) {
    console.error('Error fetching Jacobs:', err.message);
  }
}

checkJacobs();
