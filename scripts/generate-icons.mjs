import fs from 'fs';
import sharp from 'sharp';

async function generate() {
  try {
    if (!fs.existsSync('public/icons')) {
      fs.mkdirSync('public/icons', { recursive: true });
    }
    
    await sharp('public/logo.jpeg').resize(192, 192).png().toFile('public/icons/icon-192.png');
    await sharp('public/logo.jpeg').resize(512, 512).png().toFile('public/icons/icon-512.png');
    
    console.log('Successfully replaced icon files in public/icons');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generate();
