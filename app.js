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
    
    // 캘린더 탭 초기화
    initCalendarTab();
    
    // 재방문 탭 초기화
    initVisitsTab();
    
    // 마지막 백업 시각 표시
    updateLastBackupTime();

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
  
  // 전송 버튼
  document.getElementById('send-report').addEventListener('click', sendMonthlyReport);
  
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
    
    // 캘린더 업데이트
    if (typeof renderCalendar === 'function') {
      await renderCalendar();
    }
    
  } catch (error) {
    console.error('저장 오류:', error);
    showMessage('저장 중 오류가 발생했습니다.', 'error');
  }
}

// 월별 보고서 전송
async function sendMonthlyReport() {
  const year = parseInt(document.getElementById('stats-year').value);
  const month = parseInt(document.getElementById('stats-month').value);
  const lang = document.querySelector('input[name="report-lang"]:checked').value;
  
  try {
    const records = await getMonthlyRecords(year, month);
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const totalStudies = records.reduce((sum, r) => sum + r.studies, 0);
    
    // 언어별 메시지
    let message = '';
    
    if (lang === 'ko') {
      message = `${year}년 ${month}월 야외 봉사 보고\n성서 연구: ${totalStudies}\n시간: ${totalHours.toFixed(1)}\n비고: -`;
    } else if (lang === 'en') {
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'][month - 1];
      message = `FIELD SERVICE REPORT ${monthName} ${year}\nBible studies: ${totalStudies}\nHours: ${totalHours.toFixed(1)}\nComments: -`;
    } else if (lang === 'id') {
      const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][month - 1];
      message = `LAPORAN DINAS LAPANGAN ${monthName} ${year}\nPelajaran Alkitab: ${totalStudies}\nJam: ${totalHours.toFixed(1)}\nKeterangan: -`;
    }
    
    // 클립보드에 복사
try {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(message);
    showMessage('클립보드에 복사되었습니다.', 'success');
  } else {
    // 폴백: 수동 복사
    const textArea = document.createElement('textarea');
    textArea.value = message;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showMessage('클립보드에 복사되었습니다.', 'success');
  }
} catch (err) {
  console.error('복사 오류:', err);
  alert(message);
  showMessage('보고서가 생성되었습니다.', 'success');
}
    
  } catch (error) {
    console.error('전송 오류:', error);
    showMessage('전송 중 오류가 발생했습니다.', 'error');
  }
}

// 월 이름 가져오기
function getMonthName(month, lang) {
  const names = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 
         'July', 'August', 'September', 'October', 'November', 'December'],
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
         'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  };
  return names[lang][month - 1];
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
  // 백업 시각 저장
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  localStorage.setItem('lastBackupTime', timeStr);
  updateLastBackupTime();
  
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
      let message = `✅ 복원 완료!\n${result.count}개 봉사 기록`;
      if (result.visits > 0) {
        message += `, ${result.visits}개 재방문 기록`;
      }
      message += `을 가져왔습니다.`;
      showMessage(message, 'success');
      
      // 통계 및 재방문 목록 업데이트
      await loadMonthlyStats();
      await loadServiceYearTotal();
      await loadReturnVisits();
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

// 캘린더 탭 초기화
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth() + 1;

function initCalendarTab() {
  document.getElementById('prev-month').addEventListener('click', () => {
    calendarMonth--;
    if (calendarMonth < 1) {
      calendarMonth = 12;
      calendarYear--;
    }
    renderCalendar();
  });
  
  document.getElementById('next-month').addEventListener('click', () => {
    calendarMonth++;
    if (calendarMonth > 12) {
      calendarMonth = 1;
      calendarYear++;
    }
    renderCalendar();
  });
  
  // 월별 요약 보기 버튼
  document.getElementById('view-monthly-records').addEventListener('click', showMonthlyRecordsSummary);
  
  renderCalendar();
}

// 월별 기록 요약 보기
async function showMonthlyRecordsSummary() {
  const year = parseInt(document.getElementById('view-year').value);
  const month = parseInt(document.getElementById('view-month').value);
  
  try {
    const records = await getMonthlyRecords(year, month);
    
    if (records.length === 0) {
      showMessage(`${year}년 ${month}월에는 기록이 없습니다.`, 'error');
      return;
    }
    
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const totalStudies = records.reduce((sum, r) => sum + r.studies, 0);
    
    // 날짜별로 정렬
    records.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let summary = `${year}년 ${month}월 봉사 기록\n\n`;
    summary += `총 시간: ${totalHours.toFixed(1)}시간\n`;
    summary += `성서 연구: ${totalStudies}개\n\n`;
    summary += `상세 기록:\n`;
    summary += `${'-'.repeat(30)}\n`;
    
    records.forEach(record => {
      const date = new Date(record.date);
      const day = date.getDate();
      summary += `${month}/${day}: ${record.hours.toFixed(1)}시간`;
      if (record.studies > 0) {
        summary += ` | 성서연구 ${record.studies}개`;
      }
      summary += `\n`;
    });
    
    alert(summary);
    
  } catch (error) {
    console.error('요약 조회 오류:', error);
    showMessage('요약을 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

// 캘린더 렌더링
async function renderCalendar() {
  // 월/년 표시 업데이트
  document.getElementById('calendar-month-year').textContent = 
    `${calendarYear}년 ${calendarMonth}월`;
  
  // 해당 월의 기록 가져오기
  const records = await getMonthlyRecords(calendarYear, calendarMonth);
  
  // 날짜별 시간 및 성서 연구 집계
  const recordsByDate = {};
  records.forEach(record => {
    const date = record.date;
    if (!recordsByDate[date]) {
      recordsByDate[date] = { hours: 0, studies: 0 };
    }
    recordsByDate[date].hours += record.hours;
    recordsByDate[date].studies += record.studies;
  });
  
  // 캘린더 그리드 생성
  const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
  const lastDay = new Date(calendarYear, calendarMonth, 0);
  const prevLastDay = new Date(calendarYear, calendarMonth - 1, 0);
  
  const firstDayWeek = firstDay.getDay();
  const lastDate = lastDay.getDate();
  const prevLastDate = prevLastDay.getDate();
  
  let days = '';
  
  // 이전 달 날짜
  for (let i = firstDayWeek - 1; i >= 0; i--) {
    const day = prevLastDate - i;
    days += `<div style="aspect-ratio: 1; padding: 8px; background: #fafafa; color: #ccc; text-align: center; border-right: 1px solid #eee; border-bottom: 1px solid #eee; display: flex; justify-content: center; align-items: center; font-size: 16px;">
      ${day}
    </div>`;
  }
  
  // 현재 달 날짜
  const today = new Date();
  const isCurrentMonth = (calendarYear === today.getFullYear() && 
                          calendarMonth === today.getMonth() + 1);
  
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = recordsByDate[dateStr] || { hours: 0, studies: 0 };
    const hours = dayData.hours;
    const studies = dayData.studies;
    
    let bgColor = '#ffffff';
    let textColor = '#333';
    let fontWeight = 'normal';
    
    if (isCurrentMonth && day === today.getDate()) {
      bgColor = '#7E5EA5';
      textColor = '#ffffff';
      fontWeight = '700';
    } else if (hours > 0) {
      bgColor = '#7E5EA5';
      textColor = '#ffffff';
      fontWeight = '600';
    }
    
    let infoHtml = '';
    if (hours > 0) {
      const hoursText = hours.toFixed(1) + 'h';
      const studiesText = studies > 0 ? ' ' + studies + 's' : '';
      infoHtml = `<div style="font-size: 11px; opacity: 0.9;">${hoursText}<span style="color: #FFD700;">${studiesText}</div>`;
    }
    
    days += `<div style="aspect-ratio: 1; padding: 8px; background: ${bgColor}; color: ${textColor}; text-align: center; border-right: 1px solid #eee; border-bottom: 1px solid #eee; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <div style="font-size: 16px; font-weight: ${fontWeight}; margin-bottom: 4px;">${day}</div>
      ${infoHtml}
    </div>`;
  }
  
  // 다음 달 날짜 (7의 배수 맞추기)
  const totalCells = firstDayWeek + lastDate;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  
  for (let day = 1; day <= remainingCells; day++) {
    days += `<div style="aspect-ratio: 1; padding: 8px; background: #fafafa; color: #ccc; text-align: center; border-right: 1px solid #eee; border-bottom: 1px solid #eee; display: flex; justify-content: center; align-items: center; font-size: 16px;">
      ${day}
    </div>`;
  }
  
  document.getElementById('calendar-days-grid').innerHTML = days;
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

// 마지막 백업 시각 업데이트
function updateLastBackupTime() {
  const lastTime = localStorage.getItem('lastBackupTime');
  const element = document.getElementById('last-backup-time');
  if (element) {
    element.textContent = lastTime ? `마지막 백업: ${lastTime}` : '마지막 백업: -';
  }
}
