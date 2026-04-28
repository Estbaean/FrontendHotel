const fs = require('fs');
const path = 'src/components/DeleteConfirmModal.jsx';
let content = fs.readFileSync(path, 'utf8');
const oldStr = `              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: warningText }} />`;
const newStr = `              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                {warningText}
              </div>`;
if (!content.includes(oldStr)) {
  console.error('String not found');
  process.exit(1);
}
content = content.replace(oldStr, newStr);
fs.writeFileSync(path, content);
console.log('Done');
