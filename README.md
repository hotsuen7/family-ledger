# 家庭記帳本 PWA — 完整部署指南

這份指南專門寫給「完全不會寫程式」的人。**完成後你會得到一個網址,家人在 Android 手機打開就能加到主畫面變成 app**,資料即時同步,完全免費。

---

## 整體流程預覽

整個過程像在做「填表」,沒有任何程式設計工作:

1. **建立 Firebase 專案**(資料庫,讓家人共享資料)約 5 分鐘
2. **複製 Firebase 設定**到 `src/firebase.js` 約 2 分鐘
3. **上傳到 GitHub**(免費的程式碼倉庫)約 5 分鐘
4. **連 Vercel 自動部署**(免費的網站平台)約 3 分鐘
5. **完成!** 把網址給家人

總共大約 **15-20 分鐘**。

---

## 步驟 1:建立 Firebase 專案

Firebase 是 Google 的免費後端服務,免費額度足夠一個家庭用 100 年。

### 1-1. 進入 Firebase
打開瀏覽器到 https://console.firebase.google.com,用你的 Google 帳號登入。

### 1-2. 建立專案
- 點「**新增專案**」(Add project)
- 專案名稱填 `family-ledger`(或任何你喜歡的名字)
- 一直點「繼續」,**Google Analytics 那一頁可以選關閉**(用不到)
- 最後點「建立專案」,等 30 秒

### 1-3. 啟用 Firestore 資料庫
進入專案後:
- 左側選單點「**建構**」 → 「**Firestore Database**」
- 點中間的「**建立資料庫**」
- 選「**以測試模式啟動**」(Test mode)→ 下一步
- 位置選 **asia-east1**(台灣最近)→ 啟用
- 等 30 秒建立完成

### 1-4. 設定安全規則(讓家人能讀寫)
在 Firestore 頁面點上方的「**規則**」(Rules)分頁,把整個內容換成下面這段:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId} {
      allow read, write: if true;
    }
  }
}
```

點「**發布**」。

> 💡 注意:這個規則是「任何知道家庭代碼的人都能讀寫」。家庭代碼是隨機 6 碼,只要不外流就安全。要更安全可以之後加上密碼保護(我可以再幫你做)。

### 1-5. 取得設定金鑰
- 左上角點「**專案總覽**」旁的齒輪 ⚙️ → 「**專案設定**」
- 往下捲到「**你的應用程式**」區塊
- 點 **`</>`** 圖示(Web 應用程式)
- 暱稱填 `家庭記帳本` → 註冊應用程式
- **這時會看到一段程式碼,長得像這樣**:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "family-ledger-xxxxx.firebaseapp.com",
  projectId: "family-ledger-xxxxx",
  storageBucket: "family-ledger-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

**把整段 `firebaseConfig = { ... }` 複製下來**(這是你的金鑰,要保管好)。

---

## 步驟 2:把金鑰貼進專案

打開 `src/firebase.js` 這個檔案,找到開頭的 `const firebaseConfig = { ... }` 區塊,**整段替換成你剛複製的內容**。儲存。

---

## 步驟 3:上傳到 GitHub

GitHub 是放程式碼的地方,Vercel 會從這裡抓你的程式去部署。

### 3-1. 註冊 GitHub
到 https://github.com 註冊一個帳號(免費)。

### 3-2. 建立新倉庫
- 登入後右上角點 `+` → **New repository**
- Repository name 填 `family-ledger`
- 選 **Public**(公開,Vercel 免費版需要)→ 不用勾任何選項
- 點 **Create repository**

### 3-3. 上傳檔案
最簡單的方式:**用網頁直接拖曳**
- 在剛建立的倉庫頁面,點藍色按鈕 **uploading an existing file** 連結
- 把 `family-ledger-pwa` 資料夾**裡面的所有檔案和資料夾**(不是整個資料夾)拖進去
- 下方點 **Commit changes**

> 💡 重要:`node_modules` 資料夾如果有的話**不要**上傳(我給你的版本沒有,所以不用擔心)。

---

## 步驟 4:用 Vercel 部署

Vercel 是免費的網站部署服務,5 秒內幫你把程式變成網站。

### 4-1. 註冊 Vercel
到 https://vercel.com,點 **Sign Up**,選 **Continue with GitHub**(用 GitHub 登入,最方便)。

### 4-2. 匯入專案
- 登入後點 **Add New** → **Project**
- 找到 `family-ledger` 倉庫,點 **Import**
- 所有設定**保持預設**,直接點 **Deploy**
- 等 1-2 分鐘,出現「🎉 Congratulations!」就完成了

### 4-3. 拿到網址
頁面上會顯示你的網址,長得像 `https://family-ledger-xxxxx.vercel.app`。

**複製這個網址,這就是你的 app 了!**

---

## 步驟 5:在 Android 安裝成 app

### 5-1. 自己先裝
1. Android 手機打開 **Chrome**
2. 輸入你的 Vercel 網址
3. 進入後右上角選單(三個點) → **加到主畫面**(Add to Home screen)
4. 主畫面會出現「家庭記帳本」圖示,點開就跟原生 app 一樣全螢幕運作

### 5-2. 分享給家人
**這是關鍵**:不要直接給原始網址,要從 app 裡面點右上角「**分享**」按鈕,複製**帶有 family 代碼的完整網址**(例如 `https://family-ledger-xxxxx.vercel.app/?family=A3B7K9`),這樣家人加入的才是同一本帳。

家人收到網址後:
1. 在 Chrome 打開
2. 同樣加到主畫面
3. 即時同步,任何人新增的記錄,所有人 1-2 秒內看到

---

## 常見問題

**Q: 真的完全免費嗎?**
A: 是的。Firebase 有免費額度(每天 5 萬次讀取),家庭使用一輩子用不完。Vercel 個人專案永遠免費。

**Q: 資料安全嗎?**
A: 資料存在 Google 雲端(Firebase),規格上很安全。但目前的「家庭代碼」式分享如果有人知道你的代碼就能進入。如果擔心,可以(1)定期換代碼 (2)請我幫你加上密碼保護。

**Q: 沒網路時可以用嗎?**
A: PWA 可以離線開啟看舊資料,但**新增記錄需要連網**才能同步。離線記的會失敗。如果需要離線記帳功能,跟我說我可以加上。

**Q: 家人是 iPhone 怎麼辦?**
A: 一樣可以用!Safari 打開網址 → 點下方分享按鈕 → 加到主畫面。所有功能一樣。

**Q: 可以放到 Google Play 上架嗎?**
A: 可以,用 Bubblewrap 工具把這個 PWA 包成 APK 上架。但需要付 25 美金開發者費用,而且家用根本不需要上架。

**Q: 我搞砸了/卡住了怎麼辦?**
A: 把卡住的步驟和畫面截圖傳給我,我會幫你排解。

---

## 進階(等你熟了再做)

- 加密碼保護(防止家庭代碼外流)
- 預算上限警告
- 匯出 Excel
- 上架 Google Play(包成真正的 APK)
- 推播通知(家人新增大筆金額時提醒)

需要哪個功能跟我說。

---

**祝順利!做好後把網址給我,我幫你檢查一切正常。**
