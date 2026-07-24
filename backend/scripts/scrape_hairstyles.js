const { search } = require('duck-duck-scrape');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const styles = [
  // NAM
  { code: 'UNDERCUT_MALE', audience: 'MALE', name: 'Undercut' },
  { code: 'POMPADOUR_MALE', audience: 'MALE', name: 'Pompadour' },
  { code: 'QUIFF_MALE', audience: 'MALE', name: 'Quiff' },
  { code: 'SIDEPART_MALE', audience: 'MALE', name: 'Side Part' },
  { code: 'TWOBLOCK_MALE', audience: 'MALE', name: 'Two Block' },
  { code: 'MULLET_MALE', audience: 'MALE', name: 'Mullet' },
  { code: 'BUZZCUT_MALE', audience: 'MALE', name: 'Buzz Cut' },
  { code: 'CREWCUT_MALE', audience: 'MALE', name: 'Crew Cut' },
  { code: 'FRENCHCROP_MALE', audience: 'MALE', name: 'French Crop' },
  { code: 'SLICKEDBACK_MALE', audience: 'MALE', name: 'Slicked Back' },
  { code: 'MOHICAN_MALE', audience: 'MALE', name: 'Mohican' },
  { code: 'IVYLEAGUE_MALE', audience: 'MALE', name: 'Ivy League' },
  { code: 'LAYER_MALE', audience: 'MALE', name: 'Layer Nam' },
  { code: 'FAUXHAWK_MALE', audience: 'MALE', name: 'Faux Hawk' },
  { code: 'TEXTUREDFRINGE_MALE', audience: 'MALE', name: 'Textured Fringe' },
  { code: 'SHORTQUIFF_MALE', audience: 'MALE', name: 'Short Quiff' },
  { code: 'CAESARCUT_MALE', audience: 'MALE', name: 'Caesar Cut' },
  { code: 'DREADLOCKS_MALE', audience: 'MALE', name: 'Dreadlocks' },
  // NỮ
  { code: 'BOB_FEMALE', audience: 'FEMALE', name: 'Tóc Bob' },
  { code: 'LOB_FEMALE', audience: 'FEMALE', name: 'Tóc Lob (Long Bob)' },
  { code: 'PIXIE_FEMALE', audience: 'FEMALE', name: 'Pixie' },
  { code: 'LAYER_FEMALE', audience: 'FEMALE', name: 'Tóc Layer' },
  { code: 'BUTTERFLY_FEMALE', audience: 'FEMALE', name: 'Butterfly Cut' },
  { code: 'HIME_FEMALE', audience: 'FEMALE', name: 'Hime Cut' },
  { code: 'WOLF_FEMALE', audience: 'FEMALE', name: 'Wolf Cut' },
  { code: 'SHAG_FEMALE', audience: 'FEMALE', name: 'Shag Cut' },
  { code: 'WAVY_FEMALE', audience: 'FEMALE', name: 'Tóc uốn sóng nước' },
  { code: 'HIPPIE_FEMALE', audience: 'FEMALE', name: 'Tóc xoăn Hippie' },
  { code: 'CURTAINBANGS_FEMALE', audience: 'FEMALE', name: 'Tóc mái bay' },
  { code: 'WISPYBANGS_FEMALE', audience: 'FEMALE', name: 'Tóc mái thưa' },
  { code: 'STRAIGHT_FEMALE', audience: 'FEMALE', name: 'Tóc duỗi thẳng' },
  { code: 'CCURL_FEMALE', audience: 'FEMALE', name: 'Tóc cụp chữ C' },
  { code: 'BIGCURLS_FEMALE', audience: 'FEMALE', name: 'Tóc xoăn lọn to' },
  { code: 'LOOSECURLS_FEMALE', audience: 'FEMALE', name: 'Tóc uốn lơi' },
  { code: 'FLIPPEDENDS_FEMALE', audience: 'FEMALE', name: 'Tóc ngang vai uốn vểnh' },
  { code: 'MULLET_FEMALE', audience: 'FEMALE', name: 'Mullet Nữ' },
];

const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/images/hairstyles');

async function downloadImage(url, filePath) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    await fs.writeFile(filePath, response.data);
    return true;
  } catch (error) {
    return false;
  }
}

async function scrapeImages() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const style of styles) {
    const filename = `${style.code.toLowerCase().replace('_', '-')}.jpg`;
    const filePath = path.join(OUTPUT_DIR, filename);
    
    const query = `real photo ${style.name.replace('Tóc', '')} haircut ${style.audience === 'MALE' ? 'men' : 'women'} hairstyle portrait front face`;
    console.log(`Searching for: ${style.name}...`);
    
    try {
      const searchResults = await search(query);
      
      const images = searchResults.images || [];
      if (images.length === 0) {
        console.log(`No images found for ${style.name}`);
        continue;
      }
      
      let success = false;
      // Try top 5 images
      for (let i = 0; i < Math.min(5, images.length); i++) {
        const imgUrl = images[i].image; // DuckDuckGo API uses 'image' or 'url' depending on version
        const urlToFetch = imgUrl || images[i].url;
        console.log(`  Downloading ${urlToFetch}`);
        if (await downloadImage(urlToFetch, filePath)) {
          console.log(`  [OK] Saved ${filename}`);
          success = true;
          break;
        }
      }
      
      if (!success) {
        console.log(`  [FAIL] Could not download any image for ${style.name}`);
      }
    } catch (err) {
      console.error(`  [ERROR] DuckDuckGo search failed for ${style.name}:`, err.message);
    }
    
    // Sleep a bit to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
}

scrapeImages().then(() => console.log('Done'));
