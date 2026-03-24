import sharp from 'sharp';
import fs from 'fs';

async function resize() {
  if (!fs.existsSync('public/logo.jpeg')) {
    console.error('public/logo.jpeg not found!');
    process.exit(1);
  }
  try {
    // 64x64 is a strong standard size for png favicons.
    await sharp('public/logo.jpeg')
      .resize(64, 64)
      .toFormat('png')
      .toFile('public/favicon-64x64.png');
    
    // Create an apple touch icon too just in case it's needed (180x180)
    await sharp('public/logo.jpeg')
      .resize(180, 180)
      .toFormat('png')
      .toFile('public/apple-touch-icon.png');
      
    console.log('Icons resized successfully.');
  } catch (error) {
    console.error('Error resizing:', error);
    process.exit(1);
  }
}

resize();
