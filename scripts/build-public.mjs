import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (!Number.isInteger(config.step) || config.step < 1 || config.step > 12) {
  throw new Error('aleph.config.json의 step을 확인해 주세요.');
}
await mkdir(resolve(root, 'public'), { recursive: true });
// 2단계부터 메모는 api/notes.js가 Supabase에서 읽습니다. 공개 정적 자료는 만들지 않습니다.
await rm(resolve(root, 'public', 'data.json'), { force: true });
console.log('공개 정적 자료(public/data.json)는 만들지 않습니다. 메모는 /api/notes에서 읽습니다.');
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
