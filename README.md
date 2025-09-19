# WonJeong_Bank

## 1. 📌 프로젝트 주제  
vue/express를 활용한 은행 전산 시스템 만들기


## 2. 💡 프로젝트 소개  
원정은행은 기존의 오프라인으로 고객과 상호작용하는 기존 방식에서 벗어나
온라인으로 고객과 소통하는 인터넷 친화적인 은행입니다.
원정은행을 통해 자산을 불려보세요!

## 3. 👨‍👩‍👦‍👦 팀원 구성
 <table>
    <tr>
        <th>이름</th>                    
        <th>GitHub 프로필</th>
    </tr>
    <tr>
        <td>조원정</td>
        <td>https://github.com/dragonstudy9</td>
    </tr>
</table>

## 4. ⏱️ 개발 기간  
**2025.09.12 ~ 2025.09.19 (1주간)**

## 5. 🛠 사용 기술
| 분류 | 기술 |
|------|------|
| Frontend | ![Vue.js](https://img.shields.io/badge/vuejs-%2335495e.svg?style=for-the-badge&logo=vuedotjs&logoColor=%234FC08D) |
| Backend | ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white), ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB) |
| Database | ![Oracle](https://img.shields.io/badge/Oracle-F80000?style=for-the-badge&logo=oracle&logoColor=white) |
| AI | ![Google Gemini](https://img.shields.io/badge/google%20gemini-8E75B2?style=for-the-badge&logo=google%20gemini&logoColor=white)

## 6. 📑 페이지별 주요 기능 

### 1. 메인화면

- 로그인, 회원가입, 계좌조회, 예금추가 기능을 제공하는 메인 페이지이다.
- 로그인 후에는 회원정보 조회와 로그아웃 기능을 제공한다.
- 관리자인 경우, 관리자 전용 버튼을 통해 관리자 전용 페이지에 접근 가능하다.

<p align="center">
  <img src="./img/메인화면.PNG" alt="메인 화면" width="700"/>
</p>

<p align="center">
  <img src="./img/로그인후_메인화면.PNG" alt="로그인 후 메인 화면" width="700"/>
</p>

### 2. 로그인

- 아이디와 비밀번호가 오라클 DB에 저장된 고객정보와 일치하면 로그인 할 수 있다.
- 로그인하지 않은 사용자는 은행 서비스에 접근할 수 없다.
- 회원가입이 안되있는 사용자를 위해 회원가입 버튼을 통해 회원가입 페이지로 바로 이동할 수 있도록 하였다.

<p align="center">
  <img src="./img/로그인화면.PNG" alt="로그인 화면" width="700"/>
</p>

### 3. 회원가입

- 이메일을 제외한 input 태그 안에 값이 하나라도 비어있으면 회원가입이 안되도록 하였다.
- DB에 이미 있는 ID가 있으면 회원가입이 안되도록 하였다.
- 이메일을 입력한다면 이메일 형식에 맞아야만 회원가입이 가능하다.

<p align="center">
  <img src="./img/회원가입.PNG" alt="회원가입 화면" width="700"/>
</p>

### 4. 회원정보 조회

- 일반 고객은 회원정보 수정 버튼과 회원탈퇴 버튼이 보인다. 회원탈퇴 버튼을 통해 탈퇴할 수 있다.
- 관리자는 회원탈퇴 버튼에 접근할 수 없다.

<p align="center">
  <img src="./img/일반회원정보_조회.PNG" alt="일반회원정보 조회 화면" width="700"/>
</p>

<p align="center">
  <img src="./img/회원탈퇴.PNG" alt="회원탈퇴 화면" width="700"/>
</p>

<p align="center">
  <img src="./img/관리자회원정보_조회.PNG" alt="관리자회원정보 조회 화면" width="700"/>
</p>

### 5. 회원정보 수정

- 회원정보 수정화면은 처음에 들어갔을 때 회원정보조회 화면에서 보이던 정보로 값이 채워진 상태로 보여진다.

<p align="center">
  <img src="./img/회원정보수정.PNG" alt="회원정보 수정 화면" width="700"/>
</p>

## 7. 🎇 프로젝트 후기
언젠가 은행 시스템에 대해 알게 된 점을 바탕으로 내가 직접 은행 시스템을 구현해보고 싶었는데 기회가 와서 좋았다.
수업 시간에 배운 CRUD를 혼자 복습하며 연습해 볼 수 있었다.
프로젝트 진행 과정에서 AI를 적극적으로 활용하게 됐는데, 내 생각보다 AI가 내가 원하는 데로 코드를 짜주지는 않는다는 사실을 알게 되었다. 
내가 원했던 건 마치 램프 요정 지니에게 소원을 빌면 알아서 잘 해주는 거였지만 실제로는 AI가 내 의도대로 코딩하지 않는 경우도 많았다.
그럼에도 불구하고 AI 덕을 많이 보았다. 특히 페이지 꾸미는 건 거의 전적으로 AI에게 맡겼다.
이번 프로젝트 경험은 개발 과정에 대해 직접 느껴볼 수 있는 시간이었다.

### 아쉬웠던 점
- TBL_CLIENT의 PK를 CLIENT_ID로 했다면 어떨까?
- 관리자 전용 페이지에서 계좌 정보와 고객 정보를 수정하는 기능을 구현하지 못한 점이 아쉽다.
- 은행 이자를 구현 못한 점이 아쉽다.
- 대출을 구현 못한 점이 아쉽다.
- 대출 상환을 구현 못한 점이 아쉽다.
- 계좌 지급 정지/계좌지급정지 해제를 구현 못한 점이 아쉽다.
- 금융 상담 챗봇을 구현 못한 점이 아쉽다.
- 페이징 기법으로 한 페이지에 보여지는 데이터의 개수를 조절하도록 못한 점이 아쉽다.