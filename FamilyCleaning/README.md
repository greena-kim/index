# 🧹 우리집 청소

가족이 함께 쓰는 청소·정리 할 일 목록. **아이폰과 갤럭시에서 모두** 앱처럼 설치해서 쓸 수 있는 웹앱(PWA)입니다.
앱스토어 등록 없이, 링크 하나로 온 가족이 같은 목록을 실시간으로 공유해요.

## 주요 기능

- **우리 집 맞춤 프리셋**: 욕실·베란다 개수, 방 용도별 개수(안방/침실/아이방/서재/드레스룸/손님방),
  다용도실·반려동물·식물 여부를 입력하면 청소·정리 할 일을 자동 추천
  - 욕실이 2개면 `욕실 1`, `욕실 2` 각각 할 일이 생겨요
  - 추천 목록을 미리 보고 필요 없는 건 체크 해제
  - 첫 날짜를 주기 안에서 분산해서 첫날에 몰리지 않아요
  - 나중에 집 정보를 바꾸면 새로 필요한 할 일만 추가 (중복 없음)
- **반복 할 일**: 매일 / 3일마다 / 매주 / 2주마다 / 매월 / 3개월마다. 체크하면 다음 날짜로 자동 이동 (밀렸다가 해도 오늘 이후로)
- **오늘 탭**: 밀린 일 → 오늘 할 일 → 곧 할 일. 체크 후 5초간 되돌리기 가능
- **전체 탭**: 장소별로 모아 보기, 눌러서 수정·삭제
- **기록 탭**: 이번 주 청소왕 👑 (구성원별 완료 횟수) + 누가 언제 무엇을 했는지
- **담당자 지정** + "내 것만" 보기
- **가족 초대코드**(8자리)로 참여, 공유 버튼으로 카톡 등에 바로 전송
- 오프라인에서도 체크 가능 → 연결되면 자동 동기화, 다크 모드 지원

## 폰에 설치하기

| | 방법 |
|---|---|
| **아이폰** | **Safari**로 앱 주소 열기 → 하단 공유 버튼(□↑) → **홈 화면에 추가** |
| **갤럭시** | **삼성 인터넷**: 메뉴(≡) → **현재 페이지 추가 → 홈 화면** / **크롬**: 메뉴(⋮) → **앱 설치** (앱 설정 화면의 "지금 설치하기" 버튼도 가능) |

## 지금 바로 체험해 보기 (체험 모드)

`firebase-config.js`가 비어 있으면 **이 기기에만 저장되는 체험 모드**로 동작해요.

```bash
cd FamilyCleaning
npm start          # = python3 -m http.server 8080
# 브라우저에서 http://localhost:8080
```

## 가족과 공유하기 — Firebase 연결 (무료, 10분)

가족 간 실시간 공유에는 Google의 Firebase(무료 Spark 요금제로 충분)를 씁니다.

1. <https://console.firebase.google.com> → **프로젝트 추가** (Google 애널리틱스는 꺼도 됨)
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → 익명** 사용 설정
3. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → 프로덕션 모드
4. **프로젝트 설정(⚙) → 내 앱 → 웹(</>)** 앱 등록 → 표시되는 `firebaseConfig` 값을 [`firebase-config.js`](firebase-config.js)에 붙여넣기
5. 보안 규칙 배포 + 호스팅(앱 주소 만들기):
   ```bash
   npm install -g firebase-tools
   firebase login
   cd FamilyCleaning
   firebase use --add        # 방금 만든 프로젝트 선택
   firebase deploy           # firestore.rules + 호스팅 배포
   ```
6. 출력된 `https://<프로젝트>.web.app` 주소를 가족 폰에서 열고 홈 화면에 추가
7. 한 명이 **새 가족 만들기** → 설정의 **초대코드 공유** → 나머지 가족은 **초대코드로 참여**

> `firebase-config.js` 값은 비밀번호가 아니라 공개돼도 되는 앱 식별 정보예요.
> 데이터는 [`firestore.rules`](firestore.rules)가 보호합니다: 로그인한 기기만, 초대코드(가족 ID)를 아는 경우에만 접근 가능하고,
> 가족 목록 조회는 막혀 있어 다른 집 코드를 알아낼 수 없어요.

## 구조

```
FamilyCleaning/
├── index.html            화면 구조 (아이폰/안드로이드 설치용 메타 태그 포함)
├── styles.css            모바일 우선 스타일, 노치·홈바 여백, 다크 모드
├── app.js                화면 로직
├── store.js              저장소: Firestore(공유) / localStorage(체험) — 같은 인터페이스
├── logic.js              날짜·반복 계산, 통계, 초대코드 (순수 함수)
├── presets.js            집 구조 → 청소·정리 할 일 프리셋 (순수 함수)
├── firebase-config.js    Firebase 설정 (비우면 체험 모드)
├── sw.js                 오프라인용 서비스 워커
├── manifest.webmanifest  앱 이름·아이콘
├── icons/                앱 아이콘
├── fonts/pretendard/     프리텐다드 v1.3.9 (SIL OFL 1.1, 글자 조각별로 필요한 것만 내려받음)
├── firestore.rules       Firestore 보안 규칙
├── firebase.json         Firebase 배포 설정
└── tests/                node --test 단위 테스트
```

데이터 구조 (Firestore):

```
families/{초대코드}          { name, members: [...], home: {bathrooms, balconies, rooms, ...} }
  tasks/{id}                { title, area, repeat, due, assignee, done, lastDoneBy, lastDoneAt }
  logs/{id}                 { taskId, title, area, by, date, at }
```

## 개발

```bash
npm test     # 날짜·반복·프리셋 로직 테스트 (Node 18+)
```

프리셋 항목을 바꾸려면 `presets.js`의 템플릿(`T`)을 수정하세요. 파일을 고쳐 배포할 때는 `sw.js`의 `VERSION`을 올려 주세요.

## 별도 레포로 옮기기

이 폴더는 독립적으로 동작해요. 새 레포를 만든 뒤 `FamilyCleaning/` 내용을 루트로 옮기면 됩니다.

```bash
git clone https://github.com/<계정>/family-cleaning.git
cp -r index/FamilyCleaning/. family-cleaning/
cd family-cleaning && git add . && git commit -m "feat: 우리집 청소 앱" && git push
```
