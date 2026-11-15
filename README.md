# 글자숲 v0.4 🌿

일상에서 한자·한자어를 찾고, 모으고, 외우는 모바일·PC 웹앱입니다.

## 사이트
https://srum-0916.github.io/hanja-garden/

## 기술 구성
- GitHub Pages: 정적 웹사이트
- Supabase (서울 프로젝트 hfuicbjhtisawafucsrr): 계정 인증 및 사용자별 저장 기록
- index.html: 홈·검색·보관함·학습·내 정보
- cloud-auth.js, cloud-auth.css: 로그인·회원가입 화면 및 동기화

## Supabase Auth 설정 (필수)
Supabase 대시보드 → Authentication → URL Configuration
- Site URL: https://srum-0916.github.io/hanja-garden/
- Redirect URLs: https://srum-0916.github.io/hanja-garden/

기본 SMTP는 Supabase 조직 팀원 이메일에만 전송할 수 있습니다. 일반 사용자에게 회원가입을 공개하기 전에 Custom SMTP 또는 다른 적절한 인증 수단을 설정해야 합니다. 이메일 확인을 해제해 제한을 우회하지 마세요.

## 개인 기록과 보안
- 사용자별 저장 테이블 public.garden_state에 RLS 정책을 설정했습니다.
- 인증된 사용자는 자신의 행만 읽고 만들고 수정하고 삭제할 수 있습니다.
- 비로그인 방문자는 기존처럼 검색하고, 기기 내에 저장할 수 있습니다.
- 클라우드 기록을 읽기 전에 이 기기의 게스트 기록을 백업합니다.
- 다른 기기에서 데이터를 수정한 경우 덮어쓰기 전에 충돌을 감지하도록 했습니다.
- 현재 웹에는 공개용 Supabase publishable key만 포함되어 있습니다. 서비스 비밀 키는 절대 GitHub에 올리지 마세요.

## 제한 및 다음 단계
- 인증 메일 URL 구성과 실제 이메일 회원가입 테스트가 남아 있습니다.
- 여러 기기를 동시에 쓸 때는 동기화 상태를 확인하고 필요 시 JSON 백업을 이용하세요.
- 공개 출시 전에 공개 메일 발송, 계정 삭제 기능, 개인정보 안내 등을 추가해야 합니다.
- 손글씨 및 사진 인식 정확도는 별도로 검증이 필요합니다.
