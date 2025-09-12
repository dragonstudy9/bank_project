const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
app.use(cors());

// ejs 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '.'));

const config = {
    user: 'SYSTEM',
    password: 'test1234',
    connectString: 'localhost:1521/xe'
};

// Oracle 데이터베이스와 연결을 유지하기 위한 전역 변수
let connection;

// 데이터베이스 연결 설정
async function initializeDatabase() {
    try {
        // 서버 시작 시 단 하나의 연결만 생성
        connection = await oracledb.getConnection(config);
        console.log('Successfully connected to Oracle database');
    } catch (err) {
        console.error('Error connecting to Oracle database', err);
    }
}

// 애플리케이션 시작 시 연결 초기화
initializeDatabase();

// 회원가입 API (GET 메서드 - 보안에 취약함)
app.get('/join', async (req, res) => {
    try {
        const { client_id, client_password, client_status, client_name } = req.query;

        if (!client_id || !client_password || !client_status || !client_name) {
            return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
        }

        // 1. 아이디 중복 확인
        const idCheckSql = `SELECT COUNT(*) FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
        const result = await connection.execute(idCheckSql, [client_id]);
        const idCount = result.rows[0][0];

        if (idCount > 0) {
            return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다.' });
        }
        
        // 2. 새로운 고객 정보 삽입 (경고: 비밀번호가 평문으로 저장됩니다!)
        const insertSql = `
            INSERT INTO TBL_CLIENT (
                CLIENT_NO,
                CLIENT_ID,
                CLIENT_PASSWORD,
                CLIENT_NAME,
                CLIENT_STATUS,
                JOIN_DATE
            ) VALUES (
                TBL_CLIENT_SEQ.NEXTVAL,
                :client_id,
                :client_password,
                :client_name,
                :client_status,
                SYSDATE
            )
        `;

        await connection.execute(insertSql, {
            client_id: client_id,
            client_password: client_password, // 평문 비밀번호 저장
            client_name: client_name,
            client_status: client_status
        }, { autoCommit: true });

        res.status(200).json({ success: true, message: '회원가입이 완료되었습니다.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 API (GET 메서드 - 보안에 취약함)
app.get('/login', async (req, res) => {
    try {
        const { client_id, client_password } = req.query;

        if (!client_id || !client_password) {
            return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
        }

        // 1. 아이디와 비밀번호가 일치하는 사용자 조회 (경고: 평문 비밀번호 비교)
        const sql = `
            SELECT 
                CLIENT_NO,
                CLIENT_ID,
                CLIENT_NAME,
                CLIENT_STATUS
            FROM TBL_CLIENT
            WHERE CLIENT_ID = :client_id AND CLIENT_PASSWORD = :client_password
        `;
        
        const result = await connection.execute(sql, { 
            client_id: client_id,
            client_password: client_password
        });
        
        if (result.rows.length === 1) {
            // 로그인 성공
            const columnNames = result.metaData.map(col => col.name);
            const user = {};
            columnNames.forEach((colName, index) => {
                user[colName] = result.rows[0][index];
            });

            return res.status(200).json({ success: true, message: '로그인 성공!', user_info: user });
        } else {
            // 로그인 실패
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 서버 시작
const PORT = 3009;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
