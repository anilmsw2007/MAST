const fs = require('fs');
let code = fs.readFileSync('E:/MAST/App.tsx', 'utf8');

const target = `  const [busTripShift, setBusTripShift] = useState<'morning' | 'afternoon'>(() => {
    const hr = new Date().getHours();
    return hr >= 12 && hr < 18 ? 'afternoon' : 'morning';
  });`;

const replacement = `  const [busTripShift, setBusTripShift] = useState<'morning' | 'afternoon'>(() => {
    const hr = new Date().getHours();
    return hr >= 12 && hr < 18 ? 'afternoon' : 'morning';
  });
  const [activeVoiceAnnouncement, setActiveVoiceAnnouncement] = useState<{ text: string; time: string; from: string } | null>(null);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log('activeVoiceAnnouncement declared with LF');
} else {
  code = code.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
  console.log('activeVoiceAnnouncement declared with CRLF');
}

fs.writeFileSync('E:/MAST/App.tsx', code, 'utf8');
