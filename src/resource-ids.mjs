// 8단계: 서버가 요청을 구별하는 자원 ID입니다. 요청을 처리하는 서버 함수가 정하며,
// 브라우저가 보낸 주소 조각이나 머리글로 정하지 않습니다.
// 강사 공지는 아직 자료와 주소가 없어 ID만 정해 둡니다. 공지 API를 만들 때 이 값을 씁니다.
export const RESOURCE_IDS = Object.freeze({
  note: 'vault.note',
  instructorNotice: 'vault.instructor_notice',
});
