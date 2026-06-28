# 개레전드 PVP

GitHub Pages에서 실행할 수 있는 브라우저 PVP 게임입니다.

기존 Python WebSocket 서버 방식 대신, 정적 사이트 + WebRTC P2P 방식으로 바꿨습니다. GitHub Pages는 HTML/CSS/JavaScript 같은 정적 파일을 저장소에서 바로 호스팅하는 방식이므로, 게임 판정은 방장 브라우저가 맡고 친구는 P2P 데이터 채널로 입력을 보냅니다.

## 로컬 실행

Python 게임 서버는 더 이상 필요하지 않습니다. GitHub Pages와 같은 정적 파일 미리보기만 하면 됩니다.

Windows에서는 `start-site.bat`을 더블클릭하면 로컬 사이트가 열립니다. 이 방식은 내 컴퓨터에서 임시 서버를 켜는 것이므로, 열린 터미널 창을 닫거나 컴퓨터가 꺼지면 `http://127.0.0.1:3000` 접속도 끊깁니다.

```powershell
python -m http.server 3000 -d public
```

그다음 `http://127.0.0.1:3000`을 엽니다.

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. GitHub 저장소의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
3. `main` 브랜치에 push하면 `.github/workflows/pages.yml`이 `public/` 폴더를 GitHub Pages로 배포합니다.

## 플레이 방법

1. 방장이 로비에서 닉네임을 쓰고 `방 만들기`를 누릅니다.
2. 대기방에 랜덤 방 코드가 나오면 친구에게 알려줍니다.
3. 친구는 로비의 `들어갈 방 코드`에 받은 코드를 입력하고 `방 들어가기`를 누릅니다.
4. 참가자가 대기방에 들어온 것을 확인한 뒤 방장이 `게임 시작`을 누릅니다.

정적 사이트에서 짧은 방 코드 연결을 만들기 위해 PeerJS를 사용합니다. 서버 없이 브라우저끼리 직접 연결하는 방식이라, 일부 네트워크에서는 연결이 실패할 수 있습니다.
