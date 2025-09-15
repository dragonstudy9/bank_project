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
        const { 
            client_id,
            client_password,
            client_name,
            client_status,
            client_addr,
            client_phone_number,
            client_email 
        } = req.query;

        if (!client_id || !client_password || !client_status || !client_name || !client_addr || !client_phone_number) {
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
                CLIENT_EMAIL,
                CLIENT_PHONE_NUMBER,
                CLIENT_ADDR,
                JOIN_DATE
            ) VALUES (
                TBL_CLIENT_SEQ.NEXTVAL,
                :client_id,
                :client_password,
                :client_name,
                :client_status,
                :client_email,
                :client_phone_number,
                :client_addr,
                SYSDATE
            )
        `;

        // email 값이 없을 경우 명시적으로 null로 설정
        const emailToInsert = client_email || null;

        await connection.execute(insertSql, {
            client_id: client_id,
            client_password: client_password,
            client_name: client_name,
            client_status: client_status,
            client_email: emailToInsert,
            client_phone_number: client_phone_number,
            client_addr: client_addr
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

// 사용자의 이름 조회 API
app.get('/user-info', async (req, res) => {
    try {
        const { client_id } = req.query;
        if (!client_id) {
            return res.status(400).json({ success: false, message: '클라이언트 ID가 필요합니다.' });
        }

        const sql = `SELECT CLIENT_NAME FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
        const result = await connection.execute(sql, [client_id]);

        if (result.rows.length > 0) {
            const userName = result.rows[0][0];
            return res.status(200).json({ success: true, userName: userName });
        } else {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 계좌 목록 조회 API
app.get('/account/list', async (req, res) => {
    try {
        const { client_id, accountKind } = req.query;
        if (!client_id) {
            return res.status(400).json({ success: false, message: '클라이언트 ID가 누락되었습니다.' });
        }

        // 1. client_id로 CLIENT_NO를 조회합니다.
        const clientSql = `SELECT CLIENT_NO FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
        const clientResult = await connection.execute(clientSql, [client_id]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }
        const clientNo = clientResult.rows[0][0];

        // 2. 조건에 맞는 계좌 목록을 조회하는 SQL을 동적으로 생성합니다.
        let accountSql = `
            SELECT 
                ACCOUNT_NO, 
                ACCOUNT_NAME, 
                WEALTH, 
                ACCOUNT_KIND, 
                LAST_TRANSACTION_DATE, 
                CREATE_DATE
            FROM TBL_ACCOUNT
            WHERE CLIENT_NO = :clientNo
        `;
        const params = [clientNo];

        if (accountKind) {
            accountSql += ` AND ACCOUNT_KIND = :accountKind`;
            params.push(accountKind);
        }

        const accountResult = await connection.execute(accountSql, params);

        // 결과의 열 이름을 가져와서 객체 배열로 변환합니다.
        const columnNames = accountResult.metaData.map(col => col.name);
        const accountList = accountResult.rows.map(row => {
            const obj = {};
            columnNames.forEach((colName, index) => {
                obj[colName] = row[index];
            });
            return obj;
        });

        res.status(200).json({ success: true, accountList: accountList });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// ✨ 계좌 상세 정보 및 거래 내역 조회 API
app.get('/account/view', async (req, res) => {
    try {
        const { accountNo, transactionKind } = req.query;

        if (!accountNo) {
            return res.status(400).json({ success: false, message: '계좌번호가 누락되었습니다.' });
        }

        // 1. TBL_ACCOUNT 테이블에서 계좌의 이름과 잔액을 조회합니다.
        const accountSql = `
            SELECT ACCOUNT_NAME, WEALTH
            FROM TBL_ACCOUNT
            WHERE ACCOUNT_NO = :accountNo
        `;
        const accountResult = await connection.execute(accountSql, [accountNo]);
        
        if (accountResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: '계좌를 찾을 수 없습니다.' });
        }

        const accountName = accountResult.rows[0][0];
        const wealth = accountResult.rows[0][1];

        // 2. TBL_TRANSACTION 테이블에서 거래 내역을 조회합니다.
        let transactionSql = `
            SELECT
                TRANSACTION_DATE,
                TRANSACTION_NO,
                TRANSACTION_KIND,
                FROM_ACCOUNT,
                TO_ACCOUNT,
                AMOUNT,
                MEMO
            FROM TBL_TRANSACTION
            WHERE FROM_ACCOUNT = :accountNo OR TO_ACCOUNT = :accountNo
        `;
        const params = [accountNo, accountNo];

        // 거래 종류 필터가 있는 경우 WHERE 절에 추가합니다.
        if (transactionKind) {
            transactionSql += ` AND TRANSACTION_KIND = :transactionKind`;
            params.push(transactionKind);
        }

        // 최신 거래 내역이 먼저 보이도록 날짜 기준으로 정렬합니다.
        transactionSql += ` ORDER BY TRANSACTION_DATE DESC`;

        const transactionResult = await connection.execute(transactionSql, params);

        // 결과의 열 이름을 가져와서 객체 배열로 변환합니다.
        const columnNames = transactionResult.metaData.map(col => col.name);
        const transactionList = transactionResult.rows.map(row => {
            const obj = {};
            columnNames.forEach((colName, index) => {
                obj[colName] = row[index];
            });
            return obj;
        });

        // 클라이언트에 응답합니다.
        res.status(200).json({
            success: true,
            accountName: accountName,
            wealth: wealth,
            transactionList: transactionList
        });

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
