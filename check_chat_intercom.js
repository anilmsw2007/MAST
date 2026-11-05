const fs = require('fs');

const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');

// 1. Inspect handleSendChat
lines.forEach((l, idx) => {
  if (l.includes('handleSendChat') || l.includes('triggerIntercom')) {
    console.log(`Line ${idx + 1}:`);
    for (let i = idx; i <= Math.min(lines.length - 1, idx + 25); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
