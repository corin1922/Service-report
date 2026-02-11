// Google Sheets 동기화 (OAuth 전용)
const CLIENT_ID = '158141256844-5tqlfan8j8huka0q0pdd52tvrjnsj0mk.apps.googleusercontent.com';
const SPREADSHEET_ID = '1zHEbIgnEWCcZ6WDQ88bepW4Zy990D7DyUJevTjeD6IM';
const SHEET_NAME = '봉사 기록 앱 2';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email';

let tokenClient;
let accessToken = null;
let userEmail = null;

// Google API 초기화 (간소화)
function initGoogleAPI() {
  return new Promise((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // 나중에 설정
    });
    resolve();
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
  
  if (records.length === 0) {
    throw new Error('백업할 데이터가 없습니다.');
  }
  
  const values = records.map(record => [
    record.timestamp,
    userEmail,
    record.date,
    record.hours,
    0, // 재방문수
    record.studies,
    '', // 재방문이름
    record.memo || '',
    '' // 성서연구여부
  ]);
  
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values })
      }
    );
    
    if (!response.ok) {
      throw new Error(`백업 실패: ${response.status}`);
    }
    
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
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A2:I`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`복원 실패: ${response.status}`);
    }
    
    const data = await response.json();
    const rows = data.values;
    
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
    
    // 봉사 기록과 재방문 기록 분리
    let recordCount = 0;
    let visitCount = 0;
    const visitNames = new Set(); // 중복 제거용
    
    for (const row of myRows) {
      // 봉사 기록
      if (row[2] && row[3]) { // 날짜와 시간이 있으면
        const record = {
          date: row[2],
          hours: parseFloat(row[3]) || 0,
          studies: parseInt(row[5]) || 0,
          memo: row[7] || ''
        };
        await addServiceRecord(record);
        recordCount++;
      }
      
      // 재방문 기록 (중복 제거)
      if (row[6] && !visitNames.has(row[6])) { // 재방문이름이 있고 중복 아니면
        visitNames.add(row[6]);
        const visit = {
          name: row[6],
          memo: row[7] || '',
          isBibleStudy: row[8] === 'Y' || row[8] === 'y'
        };
        await addReturnVisit(visit);
        visitCount++;
      }
    }
    
    return {
      success: true,
      count: recordCount,
      visits: visitCount
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
  }
}
