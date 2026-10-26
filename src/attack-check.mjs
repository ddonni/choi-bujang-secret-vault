// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
const NOTE_SENTENCE = /실습용 가상 (?:과제|포트폴리오|리추얼|행정) 기록/gu;

function appUrl(config) {
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  return app;
}

async function anonymousGet(app, path) {
  const response = await fetch(new URL(path, app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  return { status: response.status, noteCount: text.match(NOTE_SENTENCE)?.length ?? 0 };
}

export async function runAttackChecks(config) {
  if (!Number.isInteger(config.step) || config.step < 1 || config.step > 2) {
    throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  }
  const app = appUrl(config);
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step === 1) {
    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let visible = false;
    if (response.ok) {
      try {
        const data = await response.json();
        visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
          && data.notes.length > 0;
      } catch {
        // A non-JSON response is a failed check, not a successful deployment.
      }
    }
    return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
      observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
  }
  // 2단계: 공개 정적 파일에는 메모가 없어야 하고, /api/notes는 아직 공개된 약점으로 기록합니다.
  const staticFile = await anonymousGet(app, '/data.json');
  const api = await anonymousGet(app, '/api/notes');
  return [
    { attackId: 'anonymous_static_note_read', expected: '비로그인 /data.json 요청에서 가상 메모가 보이지 않음',
      observed: `비로그인 /data.json 요청: HTTP ${staticFile.status}, 가상 메모 문장 ${staticFile.noteCount}건` },
    { attackId: 'anonymous_api_note_read', expected: '2단계 남은 약점: 비로그인 /api/notes 요청에서 가상 메모가 보임 (3단계에서 막을 예정)',
      observed: `비로그인 /api/notes 요청: HTTP ${api.status}, 가상 메모 문장 ${api.noteCount}건` },
  ];
}
