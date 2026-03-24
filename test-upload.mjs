import fs from 'fs';
import AdmZip from 'adm-zip';

// Create a dummy zip
const zip = new AdmZip();
zip.addFile('test.txt', Buffer.from('hello world', 'utf8'));
const zipBuffer = zip.toBuffer();
fs.writeFileSync('test-gen.zip', zipBuffer);

const formData = new FormData();
formData.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'test-gen.zip');

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
