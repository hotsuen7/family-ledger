// === Firebase 設定 ===
// 請把下面的 firebaseConfig 替換成你自己 Firebase 專案的設定
// 步驟在 README.md 裡有詳細說明

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

// ⚠️ 請替換成你的 Firebase 設定(從 Firebase Console 複製)
const firebaseConfig = {
  apiKey: "AIzaSyCquumi5JKyBGerVzuIPK2gmb7RyvyOisY",
  authDomain: "home-bookkeeping-a521d.firebaseapp.com",
  projectId: "home-bookkeeping-a521d",
  storageBucket: "home-bookkeeping-a521d.firebasestorage.app",
  messagingSenderId: "880951597002",
  appId: "1:880951597002:web:7f1427ed19ac0b628a2133",
  measurementId: "G-2KZS4CZXWP"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// === 家庭代碼 ===
// 同一個家庭代碼的人會共享同一本帳
// 從 URL ?family=xxx 讀取,或用預設值
function getFamilyId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get('family') || localStorage.getItem('familyId');
  if (!id) {
    // 沒指定就建立一個新的(隨機 6 碼)
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('familyId', id);
    // 把代碼放進網址,方便分享
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('family', id);
    window.history.replaceState({}, '', newUrl);
  } else {
    localStorage.setItem('familyId', id);
  }
  return id;
}

export const familyId = getFamilyId();

// === 讀取與儲存(取代原本的 window.storage) ===
const docRef = doc(db, 'families', familyId);

export async function loadData() {
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        members: data.members || [],
        txns: data.txns || []
      };
    }
    return { members: [], txns: [] };
  } catch (e) {
    console.error('載入失敗', e);
    return { members: [], txns: [] };
  }
}

export async function saveData(members, txns) {
  try {
    await setDoc(docRef, { members, txns, updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.error('儲存失敗', e);
    return false;
  }
}

// === 即時同步:當別的家人改了帳本,自動更新 ===
export function subscribeToChanges(callback) {
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        members: data.members || [],
        txns: data.txns || []
      });
    }
  }, (err) => {
    console.error('同步錯誤', err);
  });
}
