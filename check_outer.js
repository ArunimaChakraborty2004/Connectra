import fs from 'fs';

const css = fs.readFileSync('src/index.css', 'utf8');
let openBraces = 0;
const lines = css.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') openBraces++;
    else if (line[j] === '}') openBraces--;
    else if (line[j] === ';' && openBraces === 0) {
      if (!line.includes('@import')) {
        console.log(`STRAY PROPERTY at line ${i + 1}: ${line}`);
      }
    }
  }
}
