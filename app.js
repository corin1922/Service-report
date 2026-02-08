// 메인 앱 로직
let currentTab = 'home';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

// 앱 초기화
async function initApp() {
  try {
    // IndexedDB 초기화
    await initDB();
    console.log('DB 초기화 완료');
    
    // Google API 초기화
    await initGoogleAPI();
    console.log('Google API 초기화 완료');
    
    // 탭 전환 이벤트
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // 홈 탭 초기화
    initHomeTab();
    
    // 재방문 탭 초기화
    initVisitsTab();
    
    // 초기 데이터 로드
    await loadMonthlyStats();
    await loadServiceYearTotal();
    await loadReturnVisits();
    
  } catch (error) {
    console.error('앱 초기화 오류:', error);
    showMessage('앱 초기화 중 오류가 발생했습니다.', 'error');
  }
}

// 탭 전환
function switchTab(tabName) {
  currentTab = tabName;
  
  // 탭 버튼 활성화
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // 탭 컨텐츠 표시
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// 홈 탭 초기화
function initHomeTab() {
  // 오늘 날짜 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('service-date').value = today;
  
  // 봉사 기록 저장
  document.getElementById('save-service').addEventListener('click', saveServiceRecord);
  
  // 월 선택 변경
  document.getElementById('stats-year').addEventListener('change', loadMonthlyStats);
  document.getElementById('stats-month').addEventListener('change', loadMonthlyStats);
  
  // 동기화 버튼들
  document.getElementById('backup-btn').addEventListener('click', confirmBackup);
  document.getElementById('restore-btn').addEventListener('click', confirmRestore);
}

// 봉사 기록 저장
async function saveServiceRecord() {
  const date = document.getElementById('service-date').value;
  const hours = parseFloat(document.getElementById('service-hours').value) || 0;
  const minutes = parseInt(document.getElementById('service-minutes').value) || 0;
  const studies = parseInt(document.getElementById('service-studies').value) || 0;
  
  if (!date) {
    showMessage('날짜를 입력해주세요.', 'error');
    return;
  }
  
  const totalHours = hours + (minutes / 60);
  
  try {
    await addServiceRecord({
      date: date,
      hours: totalHours,
      studies: studies,
      memo: ''
    });
    
    showMessage('봉사 기록이 저장되었습니다!', 'success');
    
    // 폼 리셋
    document.getElementById('service-hours').value = '0';
    document.getElementById('service-minutes').value = '0';
    document.getElementById('service-studies').value = '0';
    
    // 통계 업데이트
    await loadMonthlyStats();
    await loadServiceYearTotal();
    
  } catch (error) {
    console.error('저장 오류:', error);
    showMessage('저장 중 오류가 발생했습니다.', 'error');
  }
}

// 월별 통계 로드
async function loadMonthlyStats() {
  const year = parseInt(document.getElementById('stats-year').value);
  const month = parseInt(document.getElementById('stats-month').value);
  
  try {
    const records = await getMonthlyRecords(year, month);
    
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const totalStudies = records.reduce((sum, r) => sum + r.studies, 0);
    
    document.getElementById('monthly-hours').textContent = totalHours.toFixed(1);
    document.getElementById('monthly-studies').textContent = totalStudies;
    
  } catch (error) {
    console.error('통계 로드 오류:', error);
  }
}

// 봉사 연도 총계 로드
async function loadServiceYearTotal() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let serviceYear, startYear, endYear;
    if (currentMonth >= 9) {
      serviceYear = currentYear + 1;
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      serviceYear = currentYear;
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    const startDate = new Date(startYear, 8, 1);
    const endDate = new Date(endYear, 7, 31, 23, 59, 59);
    
    const allRecords = await getAllServiceRecords();
    const serviceYearRecords = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
    
    const totalHours = serviceYearRecords.reduce((sum, r) => sum + r.hours, 0);
    
    document.getElementById('service-year-label').textContent = `${serviceYear} 봉사 연도`;
    document.getElementById('service-year-total').textContent = totalHours.toFixed(1);
    
  } catch (error) {
    console.error('봉사 연도 총계 로드 오류:', error);
  }
}

// 백업 확인
function confirmBackup() {
  if (confirm('⚠️ Google Sheets에 백업하시겠습니까?\n\n현재 폰에 저장된 데이터를 Google Sheets에 업로드합니다.')) {
    performBackup();
  }
}

// 백업 실행
async function performBackup() {
  try {
    showMessage('Google 로그인 중...', 'success');
    
    await signInGoogle();
    
    showMessage('백업 중...', 'success');
    
    const result = await backupToSheets();
    
    if (result.success) {
      showMessage(`✅ 백업 완료!\n${result.count}개 기록이 업로드되었습니다.`, 'success');
    }
    
  } catch (error) {
    console.error('백업 오류:', error);
    showMessage('백업 중 오류가 발생했습니다: ' + error.message, 'error');
  }
}

// 복원 확인
function confirmRestore() {
  if (confirm('⚠️ Google Sheets에서 복원하시겠습니까?\n\nGoogle Sheets의 데이터를 가져와서\n현재 폰의 데이터와 병합합니다.')) {
    performRestore();
  }
}

// 복원 실행
async function performRestore() {
  try {
    showMessage('Google 로그인 중...', 'success');
    
    await signInGoogle();
    
    showMessage('복원 중...', 'success');
    
    const result = await restoreFromSheets();
    
    if (result.success) {
      showMessage(`✅ 복원 완료!\n${result.count}개 기록을 가져왔습니다.`, 'success');
      
      // 통계 업데이트
      await loadMonthlyStats();
      await loadServiceYearTotal();
    }
    
  } catch (error) {
    console.error('복원 오류:', error);
    showMessage('복원 중 오류가 발생했습니다: ' + error.message, 'error');
  }
}

// 재방문 탭 초기화
function initVisitsTab() {
  document.getElementById('save-visit').addEventListener('click', saveReturnVisit);
}

// 재방문 저장
async function saveReturnVisit() {
  const name = document.getElementById('visit-name').value.trim();
  const memo = document.getElementById('visit-memo').value.trim();
  const isBibleStudy = document.getElementById('visit-bible-study').checked;
  
  if (!name) {
    showMessage('이름을 입력해주세요.', 'error');
    return;
  }
  
  try {
    await addReturnVisit({
      name: name,
      memo: memo,
      isBibleStudy: isBibleStudy
    });
    
    showMessage('재방문이 저장되었습니다!', 'success');
    
    // 폼 리셋
    document.getElementById('visit-name').value = '';
    document.getElementById('visit-memo').value = '';
    document.getElementById('visit-bible-study').checked = false;
    
    // 목록 업데이트
    await loadReturnVisits();
    
  } catch (error) {
    console.error('저장 오류:', error);
    showMessage('저장 중 오류가 발생했습니다.', 'error');
  }
}

// 재방문 목록 로드
async function loadReturnVisits() {
  try {
    const visits = await getAllReturnVisits();
    const container = document.getElementById('visits-list');
    
    if (visits.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">재방문 기록이 없습니다.</p>';
      return;
    }
    
    container.innerHTML = visits.map(visit => `
      <div class="visit-item">
        <div>
          <div class="visit-name">
            ${visit.isBibleStudy ? '📖 ' : ''}${escapeHtml(visit.name)}
          </div>
          ${visit.memo ? `<div class="visit-memo">${escapeHtml(visit.memo)}</div>` : ''}
        </div>
        <div class="visit-actions">
          <button class="btn btn-secondary" onclick="editVisit(${visit.id})">수정</button>
          <button class="btn btn-danger" onclick="deleteVisit(${visit.id})">삭제</button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('재방문 로드 오류:', error);
  }
}

// 재방문 삭제
async function deleteVisit(id) {
  if (confirm('정말 삭제하시겠습니까?')) {
    try {
      await deleteReturnVisit(id);
      showMessage('삭제되었습니다.', 'success');
      await loadReturnVisits();
    } catch (error) {
      console.error('삭제 오류:', error);
      showMessage('삭제 중 오류가 발생했습니다.', 'error');
    }
  }
}

// 메시지 표시
function showMessage(text, type = 'success') {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = `message message-${type}`;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Service-report/sw.js')
      .then(reg => console.log('Service Worker 등록 완료:', reg))
      .catch(err => console.error('Service Worker 등록 실패:', err));
  });
}

// 앱 시작
window.addEventListener('DOMContentLoaded', initApp);
