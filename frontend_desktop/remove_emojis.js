const fs = require('fs');
const filePath = 'app/dispatcher/DispatcherPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The regex will match all emojis that have emoji presentation (like 👥, 🚨, ✅, etc.)
// Some emojis might just be symbol characters, so we can also include \p{Extended_Pictographic}
const regex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

const originalLength = content.length;
content = content.replace(regex, '');
const newLength = content.length;

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Emojis removed. Original length: ${originalLength}, New length: ${newLength}. Replaced ${originalLength - newLength} characters.`);
