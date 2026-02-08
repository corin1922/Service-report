// Google Sheets 동기화
const CLIENT_ID = '158141256844-5tqlfan8j8huka0q0pdd52tvrjnsj0mk.apps.googleusercontent.com';
const SPREADSHEET_ID = '1zHEbIgnEWCcZ6WDQ88bepW4Zy990D7DyUJevTjeD6IM';
const SHEET_NAME = '봉사 기록 앱 2';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let accessToken = null;
let userEmail = null;

// Google API 초기화
function initGoogleAPI() {
  return new Promise((resolve) => {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
      });
      
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // 나중에 설정
      });
      
      resolve();
    });
  });
}

// Google 로그인
function signInGoogle() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response.error !== undefined) {
        reject(response);
        return;
      }
      
      accessToken = response.access_token;
      gapi.client.setToken({ access_token: accessToken });
      
      // 사용자 이메일 가져오기
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userData = await userInfo.json();
        userEmail = userData.email;
        resolve(userEmail);
      } catch (error) {
        reject(error);
      }
    };
    
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// Sheets에 데이터 백업
async function backupToSheets() {
  if (!accessToken) {
    throw new Error('Google 로그인이 필요합니다.');
  }
  
  const records = await getAllServiceRecords();
  const visits = await getAllReturnVisits();
  
  if (records.length === 0) {
    throw new Error('백업할 데이터가 없습니다.');
  }
  
  const values = records.map(record => [
    record.timestamp,
    userEmail,
    record.date,
    record.hours,
    0, // 재방문수 (현재 미사용)
    record.studies,
    '', // 재방문이름 (현재 미사용)
    record.memo || '',
    '' // 성서연구여부 (현재 미사용)
  ]);
  
  try {
    const response = await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    return {
      success: true,
      count: values.length
    };
  } catch (error) {
    throw new Error('백업 중 오류가 발생했습니다: ' + error.message);
  }
}

// Sheets에서 데이터 복원
async function restoreFromSheets() {
  if (!accessToken) {
    throw new Error('Google 로그인이 필요합니다.');
  }
  
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`,
    });
    
    const rows = response.result.values;
    
    if (!rows || rows.length === 0) {
      throw new Error('복원할 데이터가 없습니다.');
    }
    
    // 내 데이터만 필터링
    const myRows = rows.filter(row => row[1] === userEmail);
    
    if (myRows.length === 0) {
      throw new Error('내 데이터가 없습니다.');
    }
    
    // 현재 로컬 데이터 삭제
    await clearAllData();
    
    // 데이터 복원
    let count = 0;
    for (const row of myRows) {
      const record = {
        date: row[2],
        hours: parseFloat(row[3]) || 0,
        studies: parseInt(row[5]) || 0,
        memo: row[7] || ''
      };
      
      await addServiceRecord(record);
      count++;
    }
    
    return {
      success: true,
      count: count
    };
  } catch (error) {
    throw new Error('복원 중 오류가 발생했습니다: ' + error.message);
  }
}

// 로그아웃
function signOutGoogle() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
    userEmail = null;
    gapi.client.setToken(null);
  }
}
