import 'dotenv/config';
import readline from 'readline';
import { SECRET_KEYS, loadSecretStore, saveSecretStore } from '../src/utils/secrets.js';

/**
 * Local secret setup / rotation tool.
 *
 * Run with: npm run secrets:setup --workspace=backend
 * Values are written to an AES-256-GCM encrypted store outside the repository.
 * They are never written to .env or committed to source control.
 */

const current = loadSecretStore();

function question(prompt: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    if (hidden) {
      const anyRl = rl as unknown as { _writeToOutput: (value: string) => void };
      const original = anyRl._writeToOutput.bind(rl);
      anyRl._writeToOutput = (value: string) => {
        if (value.includes(prompt)) original(value);
        else original('*');
      };
    }

    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function mask(value?: string): string {
  if (!value) return '(not set)';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-2)}`;
}

async function main() {
  console.log('\nENVIS Ticket Request — encrypted secret setup');
  console.log('Press Enter to keep the current value.\n');

  const values: Record<string, string> = { ...current };

  for (const key of SECRET_KEYS) {
    const isPassword = key === 'SMTP_PASS';
    const hint = current[key] ? ` [current: ${mask(current[key])}]` : '';
    const answer = await question(`${key}${hint}: `, isPassword);
    if (answer) values[key] = answer;
  }

  const missing = SECRET_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    console.warn(`\n⚠️  Not set: ${missing.join(', ')}`);
  }

  saveSecretStore(values);
  console.log('\n✅ Secrets encrypted and stored outside the repository.');
  console.log('   Restart the backend to apply them.\n');
}

main().catch((error) => {
  console.error('Secret setup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
