const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/amil.maurya/.gemini/antigravity/brain/a0855d15-f9d1-415d-9896-54d4135d122a/.system_generated/logs/transcript_full.jsonl')
});

const mutations = [];

rl.on('line', (line) => {
  const obj = JSON.parse(line);
  if (obj.step_index > 2604 && obj.step_index <= 4858) {
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'edit_file' && tc.args.Path && tc.args.Path.includes('App.tsx')) {
          mutations.push({
            step: obj.step_index,
            type: 'edit_file',
            target: tc.args.Target,
            repl: tc.args.Replacement
          });
        } else if (tc.name === 'write_file' && tc.args.Path && (tc.args.Path.endsWith('.py') || tc.args.Path.endsWith('.js'))) {
          mutations.push({
            step: obj.step_index,
            type: 'write_file',
            path: tc.args.Path,
            content: tc.args.Content
          });
        } else if (tc.name === 'run_command') {
          const cmd = tc.args.CommandLine || '';
          if (cmd.includes('.py') || cmd.includes('.js')) {
            mutations.push({
              step: obj.step_index,
              type: 'run_command',
              cmd
            });
          }
        }
      });
    }
  }
});

rl.on('close', () => {
  console.log('Total mutations from 2605 to 4858:', mutations.length);
  fs.writeFileSync('all_mutations_complete.json', JSON.stringify(mutations, null, 2), 'utf8');
  console.log('Saved all_mutations_complete.json');
});
