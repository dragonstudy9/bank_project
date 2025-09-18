 const express = require('express');
 const cors = require('cors');
 const oracledb = require('oracledb');
 const path = require('path');

 const app = express();
 app.use(cors());

 // EJS settings
 app.set('view engine', 'ejs');
 app.set('views', path.join(__dirname, '.'));

 const dbConfig = {
   user: 'SYSTEM',
   password: 'test1234',
   connectString: 'localhost:1521/xe'
 };

 // 16자리 ID 생성 함수
 // .
 const generate16CharId = () => {
   const timestampPart = Date.now().toString(36).slice(-8); // 8자리 타임스탬프
   const randomPart = Math.random().toString(36).substring(2, 10); // 8자리 무작위 문자
   return timestampPart + randomPart;
 };

 // Initialize connection pool
 async function initializeDatabase() {
   try {
     await oracledb.createPool(dbConfig);
     console.log('Successfully connected to Oracle database');
   } catch (err) {
     console.error('Error creating connection pool', err);
   }
 }

 // Initialize the database connection pool on application start
 initializeDatabase();

 // Join API (GET method - vulnerable)
 app.get('/join', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
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
       return res.status(400).json({ success: false, message: 'Required information is missing.' });
     }

     // 1. Check for duplicate ID
     const idCheckSql = `SELECT COUNT(*) FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
     const result = await connection.execute(idCheckSql, [client_id]);
     const idCount = result.rows[0][0];

     if (idCount > 0) {
       return res.status(409).json({ success: false, message: 'This ID already exists.' });
     }

     // 2. Insert new client information (Warning: Plaintext password)
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

     res.status(200).json({ success: true, message: 'Registration completed.' });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Login API (GET method - vulnerable)
 app.get('/login', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id, client_password } = req.query;

     if (!client_id || !client_password) {
       return res.status(400).json({ success: false, message: 'Please enter your ID and password.' });
     }

     // 1. Check for matching ID and password (Warning: Plaintext password comparison)
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
       // Login successful
       const columnNames = result.metaData.map(col => col.name);
       const user = {};
       columnNames.forEach((colName, index) => {
         user[colName] = result.rows[0][index];
       });

       return res.status(200).json({ success: true, message: 'Login successful!', user_info: user });
     } else {
       // Login failed
       return res.status(401).json({ success: false, message: 'Incorrect ID or password.' });
     }
   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Client info API ( )
 app.get('/client/info', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id } = req.query;

     if (!client_id) {
       return res.status(400).json({ success: false, message: 'Client ID is required.' });
     }

     const sql = `
    SELECT
     CLIENT_ID,
     CLIENT_PASSWORD,
     CLIENT_NAME,
     CLIENT_STATUS,
     CLIENT_ADDR,
     CLIENT_PHONE_NUMBER,
     CLIENT_EMAIL,
     TO_CHAR(JOIN_DATE, 'YY/MM/DD') "joinDate"
    FROM TBL_CLIENT
    WHERE CLIENT_ID = :client_id
   `;
     const result = await connection.execute(sql, [client_id]);

     if (result.rows.length === 1) {
       const columnNames = result.metaData.map(col => col.name);
       const clientInfo = {};
       columnNames.forEach((colName, index) => {
         clientInfo[colName] = result.rows[0][index];
       });
       return res.status(200).json({ success: true, clientInfo: clientInfo });
     } else {
       return res.status(404).json({ success: false, message: 'User not found.' });
     }

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // 관리자 전용 Client info API ( )
app.get('/admin/client/list', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const { clientStatus } = req.query;

    let sql;
    let params;

    if (clientStatus) {
      sql = `
      SELECT
        CLIENT_NO,
        CLIENT_ID,
        CLIENT_PASSWORD,
        CLIENT_NAME,
        CLIENT_STATUS,
        CLIENT_ADDR,
        CLIENT_PHONE_NUMBER,
        CLIENT_EMAIL,
        TO_CHAR(JOIN_DATE, 'YY/MM/DD') "joinDate"
      FROM TBL_CLIENT
      WHERE CLIENT_STATUS = :clientStatus
      `;
      params = [clientStatus];
    } else {
      sql = `
      SELECT
        CLIENT_NO,
        CLIENT_ID,
        CLIENT_PASSWORD,
        CLIENT_NAME,
        CLIENT_STATUS,
        CLIENT_ADDR,
        CLIENT_PHONE_NUMBER,
        CLIENT_EMAIL,
        TO_CHAR(JOIN_DATE, 'YY/MM/DD') "joinDate"
      FROM TBL_CLIENT
      `;
      params = [];
    }

    const result = await connection.execute(sql, params);

    const columnNames = result.metaData.map(col => col.name);
    const clientList = result.rows.map(row => {
      const obj = {};
      columnNames.forEach((colName, index) => {
        obj[colName] = row[index];
      });
      return obj;
    });

    res.status(200).json({ success: true, clientList: clientList });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'A server error occurred.' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

 // Client edit API 추가
 app.get('/client/edit', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { CLIENT_ID, CLIENT_PASSWORD, CLIENT_NAME, CLIENT_PHONE_NUMBER, CLIENT_EMAIL } = req.query;

     if (!CLIENT_ID || !CLIENT_PASSWORD || !CLIENT_NAME || !CLIENT_PHONE_NUMBER) {
       return res.status(400).json({ success: false, message: 'Required information is missing.' });
     }

     const sql = `
      UPDATE TBL_CLIENT
      SET
       CLIENT_PASSWORD = :CLIENT_PASSWORD,
       CLIENT_NAME = :CLIENT_NAME,
       CLIENT_PHONE_NUMBER = :CLIENT_PHONE_NUMBER,
       CLIENT_EMAIL = :CLIENT_EMAIL
      WHERE CLIENT_ID = :CLIENT_ID
     `;

     await connection.execute(sql, {
       CLIENT_PASSWORD: CLIENT_PASSWORD,
       CLIENT_NAME: CLIENT_NAME,
       CLIENT_PHONE_NUMBER: CLIENT_PHONE_NUMBER,
       CLIENT_EMAIL: CLIENT_EMAIL || null,
       CLIENT_ID: CLIENT_ID
     }, { autoCommit: true });

     res.status(200).json({ success: true, message: 'User information updated successfully.' });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // client/drop API 추가
 app.get('/client/drop', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id } = req.query;

     if (!client_id) {
       return res.status(400).json({ success: false, message: 'Client ID is missing.' });
     }

     const sql = `
      DELETE FROM TBL_CLIENT
      WHERE CLIENT_ID = :client_id
     `;

     await connection.execute(sql, [client_id], { autoCommit: true });

     // Check if a row was actually deleted
     const rowsAffected = connection.rowsAffected;
     if (rowsAffected === 0) {
       return res.status(404).json({ success: false, message: 'User not found.' });
     }

     res.status(200).json({ success: true, result: 'success', message: 'User deleted successfully.' });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Account list API
 app.get('/account/list', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id, accountKind } = req.query;
     if (!client_id) {
       return res.status(400).json({ success: false, message: 'Client ID is missing.' });
     }

     // 1. Retrieve CLIENT_NO using client_id
     const clientSql = `SELECT CLIENT_NO FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
     const clientResult = await connection.execute(clientSql, [client_id]);
     if (clientResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'User not found.' });
     }
     const clientNo = clientResult.rows[0][0];

     // 2. Dynamically create SQL to retrieve account list based on the condition
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

     // Convert the result to an array of objects
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
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // 관리자 전용 Account list API
 app.get('/admin/account/list', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id, accountKind } = req.query;
     if (!client_id) {
       return res.status(400).json({ success: false, message: 'Client ID is missing.' });
     }

     // 1. Retrieve CLIENT_NO using client_id
     const clientSql = `SELECT CLIENT_NO FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
     const clientResult = await connection.execute(clientSql, [client_id]);
     if (clientResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'User not found.' });
     }
    const clientNo = clientResult.rows[0][0];

     // 2. Dynamically create SQL to retrieve account list based on the condition
     let accountSql = `
    SELECT * FROM TBL_ACCOUNT
   `;
     const params = [];

     if (accountKind) {
            accountSql += ` WHERE ACCOUNT_KIND = :accountKind`;
            params.push(accountKind);
        }

     const accountResult = await connection.execute(accountSql, params);

     // Convert the result to an array of objects
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
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Account details and transaction history API
 app.get('/account/view', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { accountNo, transactionKind } = req.query;

     if (!accountNo) {
       return res.status(400).json({ success: false, message: 'Account number is missing.' });
     }

     // 1. Retrieve account name, wealth, and kind from TBL_ACCOUNT
     const accountSql = `
    SELECT ACCOUNT_NAME, WEALTH, ACCOUNT_KIND
    FROM TBL_ACCOUNT
    WHERE ACCOUNT_NO = :accountNo
   `;
     const accountResult = await connection.execute(accountSql, [accountNo]);

     if (accountResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Account not found.' });
     }

     const accountName = accountResult.rows[0][0];
     const wealth = accountResult.rows[0][1];
     const accountKind = accountResult.rows[0][2];

     // 2. Dynamically retrieve transaction history from TBL_TRANSACTION
     let transactionSql;
     let params = [];

     // Construct SQL query and bind variables based on transaction type
     if (transactionKind === '입금') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE TO_ACCOUNT = :accountNo AND TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [accountNo, transactionKind];
     } else if (transactionKind === '출금') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE FROM_ACCOUNT = :accountNo AND TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [accountNo, transactionKind];
     } else if (transactionKind === '이체') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE (FROM_ACCOUNT = :accountNo OR TO_ACCOUNT = :accountNo) AND TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [accountNo, accountNo, transactionKind];
     } else { // '' or '전체' (All)
       transactionSql = `
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
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [accountNo, accountNo];
     }

     const transactionResult = await connection.execute(transactionSql, params);

     // Convert the result to an array of objects
     const columnNames = transactionResult.metaData.map(col => col.name);
     const transactionList = transactionResult.rows.map(row => {
       const obj = {};
       columnNames.forEach((colName, index) => {
         obj[colName] = row[index];
       });
       return obj;
     });

     // Respond to the client
     res.status(200).json({
       success: true,
       accountName: accountName,
       wealth: wealth,
       accountKind: accountKind,
       transactionList: transactionList
     });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

  // Account details and transaction history API
 app.get('/admin/transaction/list', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { transactionKind } = req.query;

     // 1. Retrieve account name, wealth, and kind from TBL_ACCOUNT
     const accountSql = `
    SELECT ACCOUNT_NAME, WEALTH, ACCOUNT_KIND
    FROM TBL_ACCOUNT
   `;
     const accountResult = await connection.execute(accountSql);

     if (accountResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Account not found.' });
     }

     const accountName = accountResult.rows[0][0];
     const wealth = accountResult.rows[0][1];
     const accountKind = accountResult.rows[0][2];

     // 2. Dynamically retrieve transaction history from TBL_TRANSACTION
     let transactionSql;
     let params = [];

     // Construct SQL query and bind variables based on transaction type
     if (transactionKind === '입금') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [transactionKind];
     } else if (transactionKind === '출금') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [transactionKind];
     } else if (transactionKind === '이체') {
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO
     FROM TBL_TRANSACTION
     WHERE TRANSACTION_KIND = :transactionKind
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [transactionKind];
     } else { // '' or '전체' (All)
       transactionSql = `
     SELECT
      TRANSACTION_DATE,
      TRANSACTION_NO,
      TRANSACTION_KIND,
      FROM_ACCOUNT,
      TO_ACCOUNT,
      AMOUNT,
      MEMO 
     FROM TBL_TRANSACTION
     ORDER BY TRANSACTION_DATE DESC
    `;
       params = [];
     }

     const transactionResult = await connection.execute(transactionSql, params);

     // Convert the result to an array of objects
     const columnNames = transactionResult.metaData.map(col => col.name);
     const transactionList = transactionResult.rows.map(row => {
       const obj = {};
       columnNames.forEach((colName, index) => {
         obj[colName] = row[index];
       });
       return obj;
     });

     // Respond to the client
     res.status(200).json({
       success: true,
       accountName: accountName,
       wealth: wealth,
       accountKind: accountKind,
       transactionList: transactionList
     });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

  // admin/transaction/delete API 추가
 app.get('/admin/transaction/delete', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { transactionNo } = req.query;

     const sql = `
      DELETE FROM TBL_TRANSACTION
      WHERE TRANSACTION_NO = :transactionNo
     `;

     await connection.execute(sql, [transactionNo], { autoCommit: true });

     // Check if a row was actually deleted
     const rowsAffected = connection.rowsAffected;
     if (rowsAffected === 0) {
       return res.status(404).json({ success: false, message: 'User not found.' });
     }

     res.status(200).json({ success: true, result: 'success', message: 'User deleted successfully.' });

   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Deposit/Withdrawal API (GET method - vulnerable)
 app.get('/deposit/self', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { accountNo, depositKind, amount, memo } = req.query;

     if (!accountNo || !depositKind || !amount) {
       return res.status(400).json({ success: false, message: 'Required information is missing.' });
     }

     const numericAmount = parseInt(amount, 10);
     if (isNaN(numericAmount) || numericAmount <= 0) {
       return res.status(400).json({ success: false, message: 'Please enter a valid amount.' });
     }

     // 1. Check account balance and update wealth in a single transaction
     let updateSql;
     let transactionKind;
     let fromAccount = null;
     let toAccount = null;
     let message;

     if (depositKind === '입금') {
       updateSql = `UPDATE TBL_ACCOUNT SET WEALTH = WEALTH + :amount, LAST_TRANSACTION_DATE = SYSDATE WHERE ACCOUNT_NO = :accountNo`;
       transactionKind = '입금';
       toAccount = accountNo;
       message = `${numericAmount.toLocaleString()} won deposited successfully.`;
     } else if (depositKind === '출금') {
       const wealthSql = `SELECT WEALTH FROM TBL_ACCOUNT WHERE ACCOUNT_NO = :accountNo FOR UPDATE`;
       const wealthResult = await connection.execute(wealthSql, [accountNo]);

       if (wealthResult.rows.length === 0) {
         return res.status(404).json({ success: false, message: 'Account not found.' });
       }

       const currentWealth = wealthResult.rows[0][0];

       if (currentWealth < numericAmount) {
         return res.json({ success: false, message: 'Insufficient balance.' });
       }
       updateSql = `UPDATE TBL_ACCOUNT SET WEALTH = WEALTH - :amount, LAST_TRANSACTION_DATE = SYSDATE WHERE ACCOUNT_NO = :accountNo`;
       transactionKind = '출금';
       fromAccount = accountNo;
       message = `${numericAmount.toLocaleString()} won withdrawn successfully.`;
     } else {
       return res.status(400).json({ success: false, message: 'Invalid transaction type.' });
     }

     // Execute both update and insert in a single transaction
     await connection.execute(updateSql, {
       amount: numericAmount,
       accountNo: accountNo
     }, { autoCommit: false });

     const newTransactionNo = generate16CharId();
     const insertTransactionSql = `
    INSERT INTO TBL_TRANSACTION (
     TRANSACTION_NO,
     TRANSACTION_KIND,
     TRANSACTION_DATE,
     FROM_ACCOUNT,
     TO_ACCOUNT,
     AMOUNT,
     MEMO
    ) VALUES (
     :transactionNo,
     :transactionKind,
     SYSDATE,
     :fromAccount,
     :toAccount,
     :amount,
     :memo
    )
   `;

     await connection.execute(insertTransactionSql, {
       transactionNo: newTransactionNo,
       transactionKind: transactionKind,
       fromAccount: fromAccount,
       toAccount: toAccount,
       amount: numericAmount,
       memo: memo || null,
     }, { autoCommit: false });

     await connection.commit();

     res.status(200).json({ success: true, message: message });

   } catch (err) {
     console.error('Error during transaction:', err);
     if (connection) {
       try {
         await connection.rollback();
       } catch (rollbackErr) {
         console.error('Error during rollback:', rollbackErr);
       }
     }
     res.status(500).json({ success: false, message: 'An error occurred during the transaction. Please try again.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // Deposit/Transfer API
 app.get('/deposit/transfer', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { accountNo, toAccount, amount, memo } = req.query;

     if (!accountNo || !toAccount || !amount) {
       return res.status(400).json({ success: false, message: 'Required information is missing.' });
     }

     const numericAmount = parseInt(amount, 10);
     if (isNaN(numericAmount) || numericAmount <= 0) {
       return res.status(400).json({ success: false, message: 'Please enter a valid amount.' });
     }

     // 1. Get the current wealth of the source account and lock the row for the transaction
     const fromWealthSql = `SELECT WEALTH FROM TBL_ACCOUNT WHERE ACCOUNT_NO = :accountNo FOR UPDATE`;
     const fromWealthResult = await connection.execute(fromWealthSql, [accountNo]);

     if (fromWealthResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Source account not found.' });
     }

     const fromWealth = fromWealthResult.rows[0][0];

     if (fromWealth < numericAmount) {
       return res.status(400).json({ success: false, message: 'Insufficient balance in the source account.' });
     }

     // 2. Check if the destination account exists
     const toAccountCheckSql = `SELECT ACCOUNT_NO FROM TBL_ACCOUNT WHERE ACCOUNT_NO = :toAccount`;
     const toAccountCheckResult = await connection.execute(toAccountCheckSql, [toAccount]);

     if (toAccountCheckResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Destination account not found.' });
     }

     // 3. Update wealth for the source account (withdrawal)
     const updateFromSql = `UPDATE TBL_ACCOUNT SET WEALTH = WEALTH - :amount, LAST_TRANSACTION_DATE = SYSDATE WHERE ACCOUNT_NO = :accountNo`;
     await connection.execute(updateFromSql, {
       amount: numericAmount,
       accountNo: accountNo
     }, { autoCommit: false });

     // 4. Update wealth for the destination account (deposit)
     const updateToSql = `UPDATE TBL_ACCOUNT SET WEALTH = WEALTH + :amount, LAST_TRANSACTION_DATE = SYSDATE WHERE ACCOUNT_NO = :toAccount`;
     await connection.execute(updateToSql, {
       amount: numericAmount,
       toAccount: toAccount
     }, { autoCommit: false });

     // 5. Insert transaction records for both accounts
     const transactionNo = generate16CharId();
     const insertTransactionSql = `
    INSERT INTO TBL_TRANSACTION (
     TRANSACTION_NO,
     TRANSACTION_KIND,
     TRANSACTION_DATE,
     FROM_ACCOUNT,
     TO_ACCOUNT,
     AMOUNT,
     MEMO
    ) VALUES (
     :transactionNo,
     :transactionKind,
     SYSDATE,
     :fromAccount,
     :toAccount,
     :amount,
     :memo
    )
   `;

     await connection.execute(insertTransactionSql, {
       transactionNo: transactionNo,
       transactionKind: '이체',
       fromAccount: accountNo,
       toAccount: toAccount,
       amount: numericAmount,
       memo: memo || null
     }, { autoCommit: false });

     // 6. Commit the transaction
     await connection.commit();

     res.status(200).json({ success: true, message: 'Transfer completed successfully.' });

   } catch (err) {
     console.error('Error during transfer:', err);
     if (connection) {
       try {
         await connection.rollback();
       } catch (rollbackErr) {
         console.error('Error during rollback:', rollbackErr);
       }
     }
     res.status(500).json({ success: false, message: 'An error occurred during the transfer. Please try again.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 app.get('/account/add', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { client_id, account_name, wealth } = req.query;

     if (!client_id || !account_name || !wealth) {
       return res.status(400).json({ success: false, message: 'Required information is missing.' });
     }

     // 1. client_id 를 사용하여 CLIENT_NO를 가져옵니다.
     const clientSql = `SELECT CLIENT_NO FROM TBL_CLIENT WHERE CLIENT_ID = :client_id`;
     const clientResult = await connection.execute(clientSql, [client_id]);

     if (clientResult.rows.length === 0) {
       return res.status(404).json({ success: false, message: 'Client not found.' });
     }

     const clientNo = clientResult.rows[0][0];

     // 2. 새 계좌를 TBL_ACCOUNT 테이블에 추가합니다.
     const insertSql = `
    INSERT INTO TBL_ACCOUNT (
     CLIENT_NO,
     ACCOUNT_NO,
     ACCOUNT_NAME,
     WEALTH,
     ACCOUNT_KIND,
     ACCOUNT_STATUS,
     LAST_TRANSACTION_DATE,
     CREATE_DATE
    ) VALUES (
     :clientNo,
     :accountNo,
     :account_name,
     :wealth,
     '예금',
     'A',
     SYSDATE,
     SYSDATE
    )
   `;

     const accountNo = generate16CharId();
     const numericWealth = parseInt(wealth, 10);

     await connection.execute(insertSql, {
       clientNo: clientNo,
       accountNo: accountNo,
       account_name: account_name,
       wealth: numericWealth,
     }, { autoCommit: true });

     res.status(200).json({ success: true, message: 'Account added successfully.', account_no: accountNo });

   } catch (err) {
     console.error('Error adding account:', err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // account/deposit/delete API
 app.get('/account/deposit/delete', async (req, res) => {
   let connection;
   try {
     connection = await oracledb.getConnection();
     const { accountNo } = req.query;

     if (!accountNo) {
       return res.status(400).json({ success: false, message: 'Account number is missing.' });
     }

     // Delete the account from TBL_ACCOUNT
     const sql = `
      DELETE FROM TBL_ACCOUNT
      WHERE ACCOUNT_NO = :accountNo
     `;
     const result = await connection.execute(sql, [accountNo], { autoCommit: true });

     // Check if a row was actually deleted
     if (result.rowsAffected === 0) {
       return res.status(404).json({ success: false, message: 'Account not found.' });
     }

     res.status(200).json({ success: true, message: 'Account deleted successfully.' });

   } catch (err) {
     console.error('Error deleting account:', err);
     res.status(500).json({ success: false, message: 'A server error occurred.' });
   } finally {
     if (connection) {
       try {
         await connection.close();
       } catch (err) {
         console.error(err);
       }
     }
   }
 });

 // account/update API (GET method)
app.get('/account/update', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const { accountNo, accountName } = req.query;

        if (!accountNo || !accountName) {
            return res.status(400).json({ success: false, message: 'Account number and name are required.' });
        }

        const sql = `
            UPDATE TBL_ACCOUNT
            SET ACCOUNT_NAME = :accountName
            WHERE ACCOUNT_NO = :accountNo
        `;

        const result = await connection.execute(sql, {
            accountName: accountName,
            accountNo: accountNo
        }, { autoCommit: true });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ success: false, message: 'Account not found or no changes made.' });
        }

        res.status(200).json({ success: true, message: 'Account name updated successfully.' });

    } catch (err) {
        console.error('Error updating account name:', err);
        res.status(500).json({ success: false, message: 'A server error occurred.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});


 // Start the server
 const PORT = 3009;
 app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
 });
