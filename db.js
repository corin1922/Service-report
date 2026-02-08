// IndexedDB 관리
const DB_NAME = 'JWServiceDB';
const DB_VERSION = 1;
const STORE_RECORDS = 'serviceRecords';
const STORE_VISITS = 'returnVisits';

let db;

// 데이터베이스 초기화
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      
      // 봉사 기록 저장소
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const recordStore = db.createObjectStore(STORE_RECORDS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        recordStore.createIndex('date', 'date', { unique: false });
        recordStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 재방문 저장소
      if (!db.objectStoreNames.contains(STORE_VISITS)) {
        const visitStore = db.createObjectStore(STORE_VISITS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        visitStore.createIndex('name', 'name', { unique: false });
      }
    };
  });
}

// 봉사 기록 추가
function addServiceRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS], 'readwrite');
    const store = transaction.objectStore(STORE_RECORDS);
    
    const data = {
      timestamp: new Date().toISOString(),
      date: record.date,
      hours: parseFloat(record.hours),
      studies: parseInt(record.studies) || 0,
      memo: record.memo || ''
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 모든 봉사 기록 가져오기
function getAllServiceRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS], 'readonly');
    const store = transaction.objectStore(STORE_RECORDS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 특정 월의 봉사 기록 가져오기
function getMonthlyRecords(year, month) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS], 'readonly');
    const store = transaction.objectStore(STORE_RECORDS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const records = request.result.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === year && 
               recordDate.getMonth() === month - 1;
      });
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

// 봉사 기록 삭제
function deleteServiceRecord(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS], 'readwrite');
    const store = transaction.objectStore(STORE_RECORDS);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 봉사 기록 업데이트
function updateServiceRecord(id, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS], 'readwrite');
    const store = transaction.objectStore(STORE_RECORDS);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      data.date = record.date;
      data.hours = parseFloat(record.hours);
      data.studies = parseInt(record.studies) || 0;
      data.memo = record.memo || '';
      
      const updateRequest = store.put(data);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// 재방문 추가
function addReturnVisit(visit) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VISITS], 'readwrite');
    const store = transaction.objectStore(STORE_VISITS);
    
    const data = {
      name: visit.name,
      memo: visit.memo || '',
      isBibleStudy: visit.isBibleStudy || false,
      timestamp: new Date().toISOString()
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 모든 재방문 가져오기
function getAllReturnVisits() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VISITS], 'readonly');
    const store = transaction.objectStore(STORE_VISITS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      // 이름순 정렬
      const visits = request.result.sort((a, b) => 
        a.name.localeCompare(b.name, 'ko')
      );
      resolve(visits);
    };
    request.onerror = () => reject(request.error);
  });
}

// 재방문 삭제
function deleteReturnVisit(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VISITS], 'readwrite');
    const store = transaction.objectStore(STORE_VISITS);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 재방문 업데이트
function updateReturnVisit(id, visit) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VISITS], 'readwrite');
    const store = transaction.objectStore(STORE_VISITS);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      data.name = visit.name;
      data.memo = visit.memo || '';
      data.isBibleStudy = visit.isBibleStudy || false;
      
      const updateRequest = store.put(data);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// 모든 데이터 삭제 (복원 시 사용)
function clearAllData() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_RECORDS, STORE_VISITS], 'readwrite');
    
    const clearRecords = transaction.objectStore(STORE_RECORDS).clear();
    const clearVisits = transaction.objectStore(STORE_VISITS).clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
