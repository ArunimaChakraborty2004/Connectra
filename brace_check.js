import fs from 'fs';

const css = fs.readFileSync('src/index.css', 'utf8');
let openBraces = 0;
const lines = css.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') openBraces++;
    else if (line[j] === '}') {
      openBraces--;
      if (openBraces < 0) {
        console.log(`EXTRA CLOSING BRACE at line ${i + 1}, column ${j + 1}`);
        process.exit(1);
      }
    }
  }
}
if (openBraces > 0) {
  console.log(`MISSING CLOSING BRACE. Left over: ${openBraces}`);
} else {
  console.log('Braces match perfectly!');
}
