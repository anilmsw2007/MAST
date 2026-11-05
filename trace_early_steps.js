const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/amil.maurya/.gemini/antigravity/brain/a0855d15-f9d1-415d-9896-54d4135d122a/.system_generated/logs/transcript_full.jsonl')
});

const steps = [];

rl.on('line', (line) => {
  const obj = JSON.parse(line);
  if (obj.step_index >= 2500 && obj.step_index < 3237) {
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'edit_file' || tc.name === 'write_file') {
          steps.push({ step: obj.step_index, name: tc.name, path: tc.args.Path });
        } else if (tc.name === 'run_command') {
          const cmd = tc.args.CommandLine || '';
          if (cmd.includes('.py') || cmd.includes('.js') || cmd.includes('git commit')) {
            steps.push({ step: obj.step_index, name: tc.name, cmd });
          }
        }
      });
    }
  }
});

rl.on('close', () => {
  console.log('Total steps found between 2500 and 3237:', steps.length);
  steps.forEach(s => console.log(s));
});
