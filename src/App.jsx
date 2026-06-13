import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, Home, PieChart, ArrowLeftRight, X, Check, UserPlus, Sparkles, Share2, HandCoins, History, Search, SlidersHorizontal, ChevronLeft, ChevronRight, CalendarDays, User, ChevronDown } from 'lucide-react';
import { loadData, saveData, subscribeToChanges, familyId } from './firebase.js';

const CATEGORIES = {
  expense: [
    { id: 'food', name: '飲食', emoji: '🍜', color: '#E8956C' },
    { id: 'grocery', name: '日用', emoji: '🛒', color: '#7AA095' },
    { id: 'transport', name: '交通', emoji: '🚇', color: '#6B8FB5' },
    { id: 'utility', name: '水電', emoji: '💡', color: '#D4A574' },
    { id: 'rent', name: '房租', emoji: '🏠', color: '#A87C7C' },
    { id: 'medical', name: '醫療', emoji: '💊', color: '#8B95C9' },
    { id: 'education', name: '教育', emoji: '📚', color: '#9C8B73' },
    { id: 'entertain', name: '娛樂', emoji: '🎬', color: '#C97B84' },
    { id: 'other_exp', name: '其他', emoji: '📝', color: '#999' },
  ],
  income: [
    { id: 'salary', name: '薪水', emoji: '💼', color: '#7AA095' },
    { id: 'bonus', name: '獎金', emoji: '🎁', color: '#E8956C' },
    { id: 'invest', name: '投資', emoji: '📈', color: '#6B8FB5' },
    { id: 'other_inc', name: '其他', emoji: '💰', color: '#D4A574' },
  ],
};

const ALL_CATS = [...CATEGORIES.expense, ...CATEGORIES.income];

const formatMoney = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatFullDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const monthKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentMonthLabel = () => {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
};

// 月份相關工具
const thisMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthKeyToLabel = (key) => {
  const [y, m] = key.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月`;
};

const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 把日期字串(YYYY-MM-DD)變成那天 00:00:00 或 23:59:59 的 ISO
const startOfDay = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfDay = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function App() {
  const [members, setMembers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState('home');
  const [showAdd, setShowAdd] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [presetSettle, setPresetSettle] = useState(null);

  // 目前檢視的月份(預設本月);影響首頁與統計頁的資料範圍
  const [viewMonth, setViewMonth] = useState(thisMonthKey());

  // 成員明細 Modal
  const [memberDetailId, setMemberDetailId] = useState(null);

  // 搜尋條件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState('all'); // all/expense/income/settlement
  const [filterCats, setFilterCats] = useState([]); // 選中的分類 id 陣列
  const [filterPayerIds, setFilterPayerIds] = useState([]); // 選中的付款人 id 陣列
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');

  useEffect(() => {
    let unsub = null;
    (async () => {
      const data = await loadData();
      setMembers(data.members);
      setTxns(data.txns);
      setLoading(false);
      unsub = subscribeToChanges((data) => {
        setMembers(data.members);
        setTxns(data.txns);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const sync = async () => {
    setSyncing(true);
    const data = await loadData();
    setMembers(data.members);
    setTxns(data.txns);
    setTimeout(() => setSyncing(false), 600);
  };

  const addMember = async (name) => {
    if (!name.trim()) return;
    const newMembers = [...members, { id: Date.now().toString(), name: name.trim() }];
    setMembers(newMembers);
    await saveData(newMembers, txns);
  };

  const removeMember = async (id) => {
    if (txns.some(t => t.payerId === id || (t.shareIds && t.shareIds.includes(id)) || t.fromId === id || t.toId === id)) {
      alert('此成員有相關交易紀錄,無法刪除');
      return;
    }
    const newMembers = members.filter(m => m.id !== id);
    setMembers(newMembers);
    await saveData(newMembers, txns);
  };

  const addTxn = async (txn) => {
    const newTxns = [{ ...txn, id: Date.now().toString() }, ...txns];
    setTxns(newTxns);
    await saveData(members, newTxns);
  };

  const addMultipleTxns = async (newOnes) => {
    const stamped = newOnes.map((t, i) => ({ ...t, id: (Date.now() + i).toString() }));
    const newTxns = [...stamped, ...txns];
    setTxns(newTxns);
    await saveData(members, newTxns);
  };

  const requestRemoveTxn = async (id) => {
    if (confirm('確定要刪除這筆記錄?')) {
      const newTxns = txns.filter(t => t.id !== id);
      setTxns(newTxns);
      await saveData(members, newTxns);
    }
  };

  // 是否處於搜尋模式(任一條件被啟用)
  const isSearching = useMemo(() => {
    return searchKeyword.trim() !== '' ||
      filterType !== 'all' ||
      filterCats.length > 0 ||
      filterPayerIds.length > 0 ||
      filterDateFrom !== '' ||
      filterDateTo !== '' ||
      filterAmountMin !== '' ||
      filterAmountMax !== '';
  }, [searchKeyword, filterType, filterCats, filterPayerIds, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax]);

  const clearSearch = () => {
    setSearchKeyword('');
    setFilterType('all');
    setFilterCats([]);
    setFilterPayerIds([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAmountMin('');
    setFilterAmountMax('');
  };

  // 套用搜尋條件後的記錄
  const filteredTxns = useMemo(() => {
    if (!isSearching) return null;

    const kw = searchKeyword.trim().toLowerCase();
    const dFrom = startOfDay(filterDateFrom);
    const dTo = endOfDay(filterDateTo);
    const minA = filterAmountMin === '' ? null : Number(filterAmountMin);
    const maxA = filterAmountMax === '' ? null : Number(filterAmountMax);

    return txns.filter(t => {
      // 類型篩選
      if (filterType !== 'all' && t.type !== filterType) return false;

      // 分類篩選(只對 expense / income 有效;settlement 沒分類所以排除掉)
      if (filterCats.length > 0) {
        if (t.type === 'settlement') return false;
        if (!filterCats.includes(t.category)) return false;
      }

      // 付款人篩選(對 expense/income 看 payerId,對 settlement 看 fromId)
      if (filterPayerIds.length > 0) {
        const candidate = t.type === 'settlement' ? t.fromId : t.payerId;
        if (!filterPayerIds.includes(candidate)) return false;
      }

      // 日期篩選
      const td = new Date(t.date);
      if (dFrom && td < dFrom) return false;
      if (dTo && td > dTo) return false;

      // 金額篩選
      const amt = Number(t.amount);
      if (minA !== null && amt < minA) return false;
      if (maxA !== null && amt > maxA) return false;

      // 關鍵字(備註 + 金額 + 分類名稱)
      if (kw) {
        const cat = ALL_CATS.find(c => c.id === t.category);
        const payer = members.find(m => m.id === (t.payerId || t.fromId));
        const target = members.find(m => m.id === t.toId);
        const haystack = [
          t.note || '',
          String(t.amount),
          cat?.name || '',
          payer?.name || '',
          target?.name || '',
          t.type === 'settlement' ? '還款' : '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(kw)) return false;
      }

      return true;
    });
  }, [isSearching, txns, searchKeyword, filterType, filterCats, filterPayerIds, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, members]);

  // 搜尋結果統計
  const searchStats = useMemo(() => {
    if (!filteredTxns) return null;
    let income = 0, expense = 0;
    filteredTxns.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      else if (t.type === 'expense') expense += Number(t.amount);
    });
    return { count: filteredTxns.length, income, expense, net: income - expense };
  }, [filteredTxns]);

  const thisMonth = thisMonthKey();
  const isViewingThisMonth = viewMonth === thisMonth;
  const monthTxns = useMemo(() => txns.filter(t => monthKey(t.date) === viewMonth), [txns, viewMonth]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    const catMap = {};
    monthTxns.forEach(t => {
      if (t.type === 'income') {
        income += Number(t.amount);
      } else if (t.type === 'expense') {
        expense += Number(t.amount);
        catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount);
      }
    });
    const catList = Object.entries(catMap)
      .map(([id, amt]) => {
        const cat = CATEGORIES.expense.find(c => c.id === id);
        return cat ? { ...cat, amount: amt } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, balance: income - expense, catList };
  }, [monthTxns]);

  // 依成員統計(用當月支出記錄,看每個人「付了」多少、各分類分佈)
  const memberStats = useMemo(() => {
    const result = members.map(m => {
      const myTxns = monthTxns.filter(t => t.type === 'expense' && t.payerId === m.id);
      let total = 0;
      const catMap = {};
      myTxns.forEach(t => {
        const amt = Number(t.amount);
        total += amt;
        catMap[t.category] = (catMap[t.category] || 0) + amt;
      });
      const catList = Object.entries(catMap)
        .map(([id, amt]) => {
          const cat = CATEGORIES.expense.find(c => c.id === id);
          return cat ? { ...cat, amount: amt } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.amount - a.amount);
      return { ...m, total, count: myTxns.length, catList };
    }).sort((a, b) => b.total - a.total);
    return result;
  }, [members, monthTxns]);

  // 某個成員的月明細(給 Modal 用)
  const memberDetail = useMemo(() => {
    if (!memberDetailId) return null;
    const member = members.find(m => m.id === memberDetailId);
    if (!member) return null;
    const stat = memberStats.find(s => s.id === memberDetailId);
    const list = monthTxns
      .filter(t => t.type === 'expense' && t.payerId === memberDetailId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return { member, stat, list };
  }, [memberDetailId, members, memberStats, monthTxns]);

  const settlement = useMemo(() => {
    const balances = {};
    members.forEach(m => { balances[m.id] = 0; });

    // 記錄每個欠款人「欠誰、因為哪筆消費、欠多少」
    // owesDetail[debtorId] = [{ txnId, toId, toName, catId, note, date, amount(我這筆分攤的金額) }]
    const owesDetail = {};
    members.forEach(m => { owesDetail[m.id] = []; });

    txns.forEach(t => {
      if (t.type === 'expense' && t.shareIds && t.shareIds.length > 0) {
        const amt = Number(t.amount);
        const share = amt / t.shareIds.length;
        if (balances[t.payerId] !== undefined) balances[t.payerId] += amt;
        t.shareIds.forEach(sid => {
          if (balances[sid] !== undefined) balances[sid] -= share;
          // 分攤者 sid 對付款人 payerId 產生 share 的欠款(自己付的不算)
          if (sid !== t.payerId && owesDetail[sid]) {
            owesDetail[sid].push({
              txnId: t.id,
              toId: t.payerId,
              catId: t.category,
              note: t.note,
              date: t.date,
              amount: share,
            });
          }
        });
      } else if (t.type === 'settlement') {
        const amt = Number(t.amount);
        if (balances[t.fromId] !== undefined) balances[t.fromId] += amt;
        if (balances[t.toId] !== undefined) balances[t.toId] -= amt;
      }
    });

    const debtors = [];
    const creditors = [];
    Object.entries(balances).forEach(([id, bal]) => {
      const member = members.find(m => m.id === id);
      if (!member) return;
      if (bal < -0.5) debtors.push({ id, name: member.name, amount: -bal });
      else if (bal > 0.5) creditors.push({ id, name: member.name, amount: bal });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const dCopy = debtors.map(d => ({ ...d }));
    const cCopy = creditors.map(c => ({ ...c }));
    const transfers = [];
    let i = 0, j = 0;
    while (i < dCopy.length && j < cCopy.length) {
      const d = dCopy[i];
      const c = cCopy[j];
      const amt = Math.min(d.amount, c.amount);
      if (amt > 0.5) {
        // 找出這位欠款人欠這位收款人的消費明細
        const sources = (owesDetail[d.id] || [])
          .filter(s => s.toId === c.id)
          .sort((a, b) => b.amount - a.amount);
        transfers.push({ fromId: d.id, from: d.name, toId: c.id, to: c.name, amount: amt, sources });
      }
      d.amount -= amt;
      c.amount -= amt;
      if (d.amount < 0.5) i++;
      if (c.amount < 0.5) j++;
    }

    return { balances, transfers };
  }, [txns, members]);

  const settlementHistory = useMemo(() => {
    return txns
      .filter(t => t.type === 'settlement')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [txns]);

  if (loading) {
    return (
      <div className="ledger-loading">
        <div className="loading-glow">記帳本準備中...</div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="ledger-app">
      <style>{styles}</style>

      <header className="ledger-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">家</div>
            <div className="brand-text">
              <div className="brand-title">家庭記帳本</div>
              {(tab === 'home' || tab === 'stats') ? (
                <div className="month-switcher">
                  <button
                    className="month-nav-btn"
                    onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
                    aria-label="上個月"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className={`month-label-btn ${!isViewingThisMonth ? 'past' : ''}`}
                    onClick={() => setViewMonth(thisMonth)}
                    title={isViewingThisMonth ? '本月' : '點擊回到本月'}
                  >
                    {monthKeyToLabel(viewMonth)}
                    {!isViewingThisMonth && <span className="back-now"> · 回本月</span>}
                  </button>
                  <button
                    className="month-nav-btn"
                    onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}
                    disabled={isViewingThisMonth}
                    aria-label="下個月"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="brand-sub">{currentMonthLabel()}</div>
              )}
            </div>
          </div>
          <div className="header-actions">
            {tab === 'home' && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`sync-btn ${showSearch || isSearching ? 'active' : ''}`}
                title="搜尋"
              >
                <Search size={16} />
                {isSearching && <span className="search-dot" />}
              </button>
            )}
            <button onClick={() => setShowShare(true)} className="sync-btn" title="分享給家人">
              <Share2 size={16} />
            </button>
            <button onClick={sync} className={`sync-btn ${syncing ? 'syncing' : ''}`} title="同步">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="ledger-main">
        {tab === 'home' && (
          <>
            {showSearch && (
              <SearchPanel
                members={members}
                searchKeyword={searchKeyword} setSearchKeyword={setSearchKeyword}
                filterType={filterType} setFilterType={setFilterType}
                filterCats={filterCats} setFilterCats={setFilterCats}
                filterPayerIds={filterPayerIds} setFilterPayerIds={setFilterPayerIds}
                filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
                filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
                filterAmountMin={filterAmountMin} setFilterAmountMin={setFilterAmountMin}
                filterAmountMax={filterAmountMax} setFilterAmountMax={setFilterAmountMax}
                isSearching={isSearching}
                onClear={clearSearch}
                onClose={() => setShowSearch(false)}
              />
            )}
            {isSearching ? (
              <SearchResultTab
                filteredTxns={filteredTxns}
                searchStats={searchStats}
                members={members}
                onDelete={requestRemoveTxn}
                onClearSearch={clearSearch}
              />
            ) : (
              <HomeTab
                stats={stats}
                txns={txns}
                monthTxns={monthTxns}
                members={members}
                onDelete={requestRemoveTxn}
                isViewingThisMonth={isViewingThisMonth}
                viewMonth={viewMonth}
              />
            )}
          </>
        )}
        {tab === 'stats' && (
          <StatsTab
            stats={stats}
            monthTxns={monthTxns}
            memberStats={memberStats}
            members={members}
            onShowMemberDetail={(id) => setMemberDetailId(id)}
            isViewingThisMonth={isViewingThisMonth}
            viewMonth={viewMonth}
          />
        )}
        {tab === 'split' && (
          <SplitTab
            members={members}
            settlement={settlement}
            settlementHistory={settlementHistory}
            onAddMember={() => setShowAddMember(true)}
            onRemoveMember={removeMember}
            onSettleOne={(transfer) => {
              setPresetSettle(transfer);
              setShowSettle(true);
            }}
            onSettleAll={async () => {
              if (settlement.transfers.length === 0) return;
              if (!confirm(`確定要一次結清所有款項?將會自動建立 ${settlement.transfers.length} 筆還款記錄。`)) return;
              const newOnes = settlement.transfers.map(t => ({
                type: 'settlement',
                amount: t.amount,
                fromId: t.fromId,
                toId: t.toId,
                note: '一鍵結清',
                date: new Date().toISOString(),
              }));
              await addMultipleTxns(newOnes);
            }}
            onShowHistory={() => setShowHistory(true)}
          />
        )}
      </main>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="新增記錄">
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <nav className="ledger-nav">
        <button onClick={() => setTab('home')} className={tab === 'home' ? 'nav-btn active' : 'nav-btn'}>
          <Home size={20} />
          <span>首頁</span>
        </button>
        <button onClick={() => setTab('stats')} className={tab === 'stats' ? 'nav-btn active' : 'nav-btn'}>
          <PieChart size={20} />
          <span>統計</span>
        </button>
        <button onClick={() => setTab('split')} className={tab === 'split' ? 'nav-btn active' : 'nav-btn'}>
          <ArrowLeftRight size={20} />
          <span>分帳</span>
        </button>
      </nav>

      {showAdd && (
        <AddTxnModal
          members={members}
          onClose={() => setShowAdd(false)}
          onSubmit={async (txn) => { await addTxn(txn); setShowAdd(false); }}
          onAddMember={() => { setShowAdd(false); setShowAddMember(true); }}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          members={members}
          onClose={() => setShowAddMember(false)}
          onAdd={addMember}
          onRemove={removeMember}
        />
      )}

      {showShare && <ShareModal onClose={() => setShowShare(false)} />}

      {showSettle && (
        <SettleModal
          members={members}
          preset={presetSettle}
          onClose={() => { setShowSettle(false); setPresetSettle(null); }}
          onSubmit={async (txn) => {
            await addTxn(txn);
            setShowSettle(false);
            setPresetSettle(null);
          }}
        />
      )}

      {showHistory && (
        <HistoryModal
          history={settlementHistory}
          members={members}
          onClose={() => setShowHistory(false)}
          onDelete={requestRemoveTxn}
        />
      )}

      {memberDetail && (
        <MemberDetailModal
          detail={memberDetail}
          monthLabel={isViewingThisMonth ? '本月' : monthKeyToLabel(viewMonth)}
          onClose={() => setMemberDetailId(null)}
        />
      )}
    </div>
  );
}

// 搜尋面板
function SearchPanel({
  members,
  searchKeyword, setSearchKeyword,
  filterType, setFilterType,
  filterCats, setFilterCats,
  filterPayerIds, setFilterPayerIds,
  filterDateFrom, setFilterDateFrom,
  filterDateTo, setFilterDateTo,
  filterAmountMin, setFilterAmountMin,
  filterAmountMax, setFilterAmountMax,
  isSearching, onClear, onClose,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleCat = (id) => {
    setFilterCats(filterCats.includes(id) ? filterCats.filter(x => x !== id) : [...filterCats, id]);
  };
  const togglePayer = (id) => {
    setFilterPayerIds(filterPayerIds.includes(id) ? filterPayerIds.filter(x => x !== id) : [...filterPayerIds, id]);
  };

  // 快速日期捷徑
  const setQuickDate = (kind) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (kind === 'thismonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setFilterDateFrom(start);
      setFilterDateTo(today);
    } else if (kind === 'lastmonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setFilterDateFrom(start);
      setFilterDateTo(end);
    } else if (kind === 'last7') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setFilterDateFrom(d.toISOString().slice(0, 10));
      setFilterDateTo(today);
    } else if (kind === 'last30') {
      const d = new Date(); d.setDate(d.getDate() - 29);
      setFilterDateFrom(d.toISOString().slice(0, 10));
      setFilterDateTo(today);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-wrap">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="搜尋備註、金額、分類..."
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          autoFocus
        />
        {searchKeyword && (
          <button className="search-clear" onClick={() => setSearchKeyword('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* 類型快速篩選 */}
      <div className="search-row">
        <div className="filter-chips">
          <button className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>全部</button>
          <button className={`filter-chip ${filterType === 'expense' ? 'active' : ''}`} onClick={() => setFilterType('expense')}>支出</button>
          <button className={`filter-chip ${filterType === 'income' ? 'active' : ''}`} onClick={() => setFilterType('income')}>收入</button>
          <button className={`filter-chip ${filterType === 'settlement' ? 'active' : ''}`} onClick={() => setFilterType('settlement')}>還款</button>
        </div>
        <button className={`adv-toggle ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)}>
          <SlidersHorizontal size={14} />
          進階
        </button>
      </div>

      {showAdvanced && (
        <div className="advanced-filters">
          {/* 分類 */}
          {(filterType === 'all' || filterType === 'expense' || filterType === 'income') && (
            <div className="filter-group">
              <div className="filter-label">分類</div>
              <div className="filter-cat-grid">
                {(filterType === 'income' ? CATEGORIES.income : filterType === 'expense' ? CATEGORIES.expense : ALL_CATS).map(c => (
                  <button
                    key={c.id}
                    className={`filter-cat-chip ${filterCats.includes(c.id) ? 'active' : ''}`}
                    onClick={() => toggleCat(c.id)}
                    style={filterCats.includes(c.id) ? { background: c.color, borderColor: c.color, color: 'white' } : {}}
                  >
                    <span>{c.emoji}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 付款人 / 還款人 */}
          {members.length > 0 && (
            <div className="filter-group">
              <div className="filter-label">{filterType === 'settlement' ? '還款人' : '付款人'}</div>
              <div className="filter-payer-row">
                {members.map(m => (
                  <button
                    key={m.id}
                    className={`filter-payer-chip ${filterPayerIds.includes(m.id) ? 'active' : ''}`}
                    onClick={() => togglePayer(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 日期 */}
          <div className="filter-group">
            <div className="filter-label">日期範圍</div>
            <div className="filter-quick-date">
              <button className="quick-date-btn" onClick={() => setQuickDate('thismonth')}>本月</button>
              <button className="quick-date-btn" onClick={() => setQuickDate('lastmonth')}>上月</button>
              <button className="quick-date-btn" onClick={() => setQuickDate('last7')}>近 7 天</button>
              <button className="quick-date-btn" onClick={() => setQuickDate('last30')}>近 30 天</button>
            </div>
            <div className="filter-date-row">
              <input type="date" className="filter-date-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="從" />
              <span className="filter-date-sep">至</span>
              <input type="date" className="filter-date-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="到" />
            </div>
          </div>

          {/* 金額 */}
          <div className="filter-group">
            <div className="filter-label">金額範圍</div>
            <div className="filter-amount-row">
              <input type="number" className="filter-amount-input" placeholder="最小" value={filterAmountMin} onChange={e => setFilterAmountMin(e.target.value)} inputMode="decimal" />
              <span className="filter-date-sep">至</span>
              <input type="number" className="filter-amount-input" placeholder="最大" value={filterAmountMax} onChange={e => setFilterAmountMax(e.target.value)} inputMode="decimal" />
            </div>
          </div>
        </div>
      )}

      <div className="search-actions">
        {isSearching && (
          <button className="search-clear-btn" onClick={onClear}>
            <X size={14} />
            清除條件
          </button>
        )}
        <button className="search-close-btn" onClick={onClose}>收起</button>
      </div>
    </div>
  );
}

// 搜尋結果頁
function SearchResultTab({ filteredTxns, searchStats, members, onDelete, onEdit, onClearSearch }) {
  return (
    <div className="tab-search-result">
      <div className="result-summary">
        <div className="result-count">
          找到 <strong>{searchStats.count}</strong> 筆記錄
        </div>
        {(searchStats.income > 0 || searchStats.expense > 0) && (
          <div className="result-stats">
            {searchStats.income > 0 && (
              <span className="result-stat income">收入 +{formatMoney(searchStats.income)}</span>
            )}
            {searchStats.expense > 0 && (
              <span className="result-stat expense">支出 -{formatMoney(searchStats.expense)}</span>
            )}
            {searchStats.income > 0 && searchStats.expense > 0 && (
              <span className={`result-stat net ${searchStats.net < 0 ? 'neg' : ''}`}>
                淨額 {searchStats.net >= 0 ? '+' : ''}{formatMoney(searchStats.net)}
              </span>
            )}
          </div>
        )}
      </div>

      {filteredTxns.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🔍</div>
          <div className="empty-text">沒有符合的記錄</div>
          <div className="empty-hint">試著放寬篩選條件</div>
          <button className="empty-btn" onClick={onClearSearch}>清除條件</button>
        </div>
      ) : (
        <div className="txn-list">
          {filteredTxns.map(t => {
            if (t.type === 'settlement') {
              const from = members.find(m => m.id === t.fromId);
              const to = members.find(m => m.id === t.toId);
              return (
                <div key={t.id} className="txn-item">
                  <div className="txn-icon settle-icon"><HandCoins size={18} /></div>
                  <div className="txn-mid">
                    <div className="txn-top">
                      <span className="txn-cat">還款</span>
                      <span className="txn-note"> · {from?.name || '?'} → {to?.name || '?'}</span>
                    </div>
                    <div className="txn-meta">
                      {formatFullDate(t.date)}
                      {t.note && <span> · {t.note}</span>}
                    </div>
                  </div>
                  <div className="txn-right">
                    <div className="txn-amt settle">↻ {formatMoney(t.amount)}</div>
                    <button className="txn-del" onClick={() => onDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }
            const cat = ALL_CATS.find(c => c.id === t.category);
            const payer = members.find(m => m.id === t.payerId);
            return (
              <div key={t.id} className="txn-item">
                <div className="txn-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || '#999' }}>
                  {cat?.emoji || '📝'}
                </div>
                <div className="txn-mid">
                  <div className="txn-top">
                    <span className="txn-cat">{cat?.name || '其他'}</span>
                    {t.note && <span className="txn-note">· {t.note}</span>}
                  </div>
                  <div className="txn-meta">
                    {formatFullDate(t.date)}
                    {payer && <span> · {payer.name} 付</span>}
                    {t.shareIds && t.shareIds.length > 1 && <span> · {t.shareIds.length} 人分</span>}
                  </div>
                </div>
                <div className="txn-right">
                  <div className={`txn-amt ${t.type}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                  </div>
                  {onEdit && (
                    <button className="txn-edit" onClick={() => onEdit(t)}>
                      <Pencil size={13} />
                    </button>
                  )}
                  <button className="txn-del" onClick={() => onDelete(t.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShareModal({ onClose }) {
  const url = window.location.href;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-small" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">分享給家人</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
            複製下方連結傳給家人,他們打開後就會自動加入同一本帳。家庭代碼:<strong style={{ color: 'var(--accent)' }}>{familyId}</strong>
          </p>
          <div className="share-url">{url}</div>
          <button className="btn-submit btn-full" onClick={copy} style={{ marginTop: 14 }}>
            {copied ? '已複製!' : '複製連結'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeTab({ stats, monthTxns, members, onDelete, onEdit, isViewingThisMonth, viewMonth }) {
  const recent = monthTxns.slice(0, 50);
  const monthLabel = isViewingThisMonth ? '本月' : monthKeyToLabel(viewMonth);
  return (
    <div className="tab-home">
      <div className={`balance-card ${!isViewingThisMonth ? 'past' : ''}`}>
        <div className="balance-bg" />
        {!isViewingThisMonth && (
          <div className="past-badge">📅 歷史月份</div>
        )}
        <div className="balance-label">{monthLabel}結餘</div>
        <div className={`balance-num ${stats.balance < 0 ? 'neg' : ''}`}>
          NT$ {formatMoney(stats.balance)}
        </div>
        <div className="balance-row">
          <div className="balance-cell">
            <div className="cell-label">收入</div>
            <div className="cell-num income">+{formatMoney(stats.income)}</div>
          </div>
          <div className="cell-divider" />
          <div className="balance-cell">
            <div className="cell-label">支出</div>
            <div className="cell-num expense">-{formatMoney(stats.expense)}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">{monthLabel}記錄</div>
          <div className="section-count">{monthTxns.length} 筆</div>
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">{isViewingThisMonth ? '🌱' : '📭'}</div>
            <div className="empty-text">{isViewingThisMonth ? '這個月還沒有記錄' : `${monthLabel}沒有記錄`}</div>
            {isViewingThisMonth && <div className="empty-hint">點右下角 + 開始記帳</div>}
          </div>
        ) : (
          <div className="txn-list">
            {recent.map(t => {
              if (t.type === 'settlement') {
                const from = members.find(m => m.id === t.fromId);
                const to = members.find(m => m.id === t.toId);
                return (
                  <div key={t.id} className="txn-item">
                    <div className="txn-icon settle-icon"><HandCoins size={18} /></div>
                    <div className="txn-mid">
                      <div className="txn-top">
                        <span className="txn-cat">還款</span>
                        <span className="txn-note"> · {from?.name || '?'} → {to?.name || '?'}</span>
                      </div>
                      <div className="txn-meta">
                        {formatDate(t.date)}
                        {t.note && <span> · {t.note}</span>}
                      </div>
                    </div>
                    <div className="txn-right">
                      <div className="txn-amt settle">↻ {formatMoney(t.amount)}</div>
                      <button className="txn-del" onClick={() => onDelete(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              }

              const cat = (t.type === 'expense' ? CATEGORIES.expense : CATEGORIES.income).find(c => c.id === t.category);
              const payer = members.find(m => m.id === t.payerId);
              return (
                <div key={t.id} className="txn-item">
                  <div className="txn-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || '#999' }}>
                    {cat?.emoji || '📝'}
                  </div>
                  <div className="txn-mid">
                    <div className="txn-top">
                      <span className="txn-cat">{cat?.name || '其他'}</span>
                      {t.note && <span className="txn-note">· {t.note}</span>}
                    </div>
                    <div className="txn-meta">
                      {formatDate(t.date)}
                      {payer && <span> · {payer.name} 付</span>}
                      {t.shareIds && t.shareIds.length > 1 && <span> · {t.shareIds.length} 人分</span>}
                    </div>
                  </div>
                  <div className="txn-right">
                    <div className={`txn-amt ${t.type}`}>
                      {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                    </div>
                    {onEdit && (
                      <button className="txn-edit" onClick={() => onEdit(t)}>
                        <Pencil size={13} />
                      </button>
                    )}
                    <button className="txn-del" onClick={() => onDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsTab({ stats, monthTxns, memberStats, members, onShowMemberDetail, isViewingThisMonth, viewMonth }) {
  const [subTab, setSubTab] = useState('category'); // 'category' or 'member'
  const totalExp = stats.expense || 1;
  const expenseCount = monthTxns.filter(t => t.type === 'expense').length;
  const monthLabel = isViewingThisMonth ? '本月' : monthKeyToLabel(viewMonth);

  return (
    <div className="tab-stats">
      <div className={`stats-summary ${!isViewingThisMonth ? 'past' : ''}`}>
        {!isViewingThisMonth && (
          <div className="past-badge-mini">📅 {monthLabel}</div>
        )}
        <div className="stats-big">
          <div className="stats-label">{monthLabel}支出</div>
          <div className="stats-num">NT$ {formatMoney(stats.expense)}</div>
          <div className="stats-meta">{expenseCount} 筆消費</div>
        </div>
      </div>

      {/* Sub-tab 切換 */}
      <div className="subtab-bar">
        <button
          className={`subtab-btn ${subTab === 'category' ? 'active' : ''}`}
          onClick={() => setSubTab('category')}
        >
          <PieChart size={14} />
          依分類
        </button>
        <button
          className={`subtab-btn ${subTab === 'member' ? 'active' : ''}`}
          onClick={() => setSubTab('member')}
        >
          <User size={14} />
          依成員
        </button>
      </div>

      {subTab === 'category' && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">分類統計</div>
          </div>
          {stats.catList.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">📊</div>
              <div className="empty-text">{monthLabel}還沒有支出記錄</div>
            </div>
          ) : (
            <div className="cat-list">
              {stats.catList.map(c => {
                const pct = (c.amount / totalExp) * 100;
                return (
                  <div key={c.id} className="cat-item">
                    <div className="cat-row">
                      <div className="cat-name">
                        <span className="cat-emoji">{c.emoji}</span>
                        <span>{c.name}</span>
                      </div>
                      <div className="cat-amt">
                        <span className="cat-money">{formatMoney(c.amount)}</span>
                        <span className="cat-pct">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="cat-bar">
                      <div className="cat-fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'member' && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">成員付款統計</div>
            <div className="section-count">點卡片看明細</div>
          </div>
          {members.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">👨‍👩‍👧</div>
              <div className="empty-text">還沒有成員</div>
              <div className="empty-hint">先到「分帳」頁加入家人</div>
            </div>
          ) : memberStats.every(s => s.total === 0) ? (
            <div className="empty">
              <div className="empty-emoji">💸</div>
              <div className="empty-text">{monthLabel}還沒有人付款</div>
            </div>
          ) : (
            <div className="member-stat-list">
              {memberStats.map(s => {
                const pct = s.total > 0 ? (s.total / totalExp) * 100 : 0;
                return (
                  <button
                    key={s.id}
                    className="member-stat-card"
                    onClick={() => s.total > 0 && onShowMemberDetail(s.id)}
                    disabled={s.total === 0}
                  >
                    <div className="member-stat-head">
                      <div className="member-stat-avatar">{s.name.charAt(0)}</div>
                      <div className="member-stat-info">
                        <div className="member-stat-name">{s.name}</div>
                        <div className="member-stat-meta">
                          {s.total > 0 ? `${s.count} 筆 · 佔總支出 ${pct.toFixed(0)}%` : '本月沒有付款'}
                        </div>
                      </div>
                      <div className="member-stat-amt">
                        NT$ {formatMoney(s.total)}
                      </div>
                    </div>
                    {s.total > 0 && (
                      <>
                        <div className="member-stat-bar">
                          <div className="member-stat-fill" style={{ width: `${pct}%` }} />
                        </div>
                        {s.catList.length > 0 && (
                          <div className="member-stat-cats">
                            {s.catList.slice(0, 4).map(c => (
                              <div key={c.id} className="member-stat-cat">
                                <span className="msc-emoji">{c.emoji}</span>
                                <span className="msc-name">{c.name}</span>
                                <span className="msc-amt">{formatMoney(c.amount)}</span>
                              </div>
                            ))}
                            {s.catList.length > 4 && (
                              <div className="member-stat-cat more">
                                +{s.catList.length - 4} 類
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 待結算卡片(可展開看欠款來源)
function TransferCard({ transfer, members, onSettleOne }) {
  const [expanded, setExpanded] = useState(false);
  const sources = transfer.sources || [];
  // 把同一筆消費的多次分攤合併(理論上不會重複,但保險)
  const hasSources = sources.length > 0;

  return (
    <div className="transfer-card">
      <div className="transfer-row">
        <div className="transfer-from">{transfer.from}</div>
        <div className="transfer-arrow">
          <div className="arrow-line" />
          <div className="arrow-amt">NT$ {formatMoney(transfer.amount)}</div>
        </div>
        <div className="transfer-to">{transfer.to}</div>
      </div>

      {hasSources && (
        <button className="source-toggle" onClick={() => setExpanded(!expanded)}>
          <ChevronDown size={13} className={expanded ? 'rotated' : ''} />
          {expanded ? '收起明細' : `看是哪些消費(${sources.length} 筆)`}
        </button>
      )}

      {expanded && hasSources && (
        <div className="source-list">
          <div className="source-hint">{transfer.from} 因為這些消費而欠 {transfer.to}:</div>
          {sources.map((s, idx) => {
            const cat = CATEGORIES.expense.find(c => c.id === s.catId);
            return (
              <div key={idx} className="source-item">
                <div className="source-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || '#999' }}>
                  {cat?.emoji || '📝'}
                </div>
                <div className="source-mid">
                  <div className="source-top">
                    {cat?.name || '其他'}
                    {s.note && <span className="txn-note"> · {s.note}</span>}
                  </div>
                  <div className="source-meta">{formatFullDate(s.date)}</div>
                </div>
                <div className="source-amt">NT$ {formatMoney(s.amount)}</div>
              </div>
            );
          })}
          {(() => {
            const sourceTotal = sources.reduce((sum, s) => sum + s.amount, 0);
            const diff = sourceTotal - transfer.amount;
            if (diff > 0.5) {
              return (
                <div className="source-note">
                  小計 NT$ {formatMoney(sourceTotal)},扣掉 {transfer.to} 也欠 {transfer.from} 的部分,實際應還 <strong>NT$ {formatMoney(transfer.amount)}</strong>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      <button className="settle-btn" onClick={() => onSettleOne(transfer)}>
        <HandCoins size={14} />
        記錄已還款
      </button>
    </div>
  );
}

function SplitTab({ members, settlement, settlementHistory, onAddMember, onRemoveMember, onSettleOne, onSettleAll, onShowHistory }) {
  return (
    <div className="tab-split">
      <div className="section">
        <div className="section-head">
          <div className="section-title">家庭成員</div>
          <button className="head-action" onClick={onAddMember}>
            <UserPlus size={14} />
            管理
          </button>
        </div>
        {members.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">👨‍👩‍👧</div>
            <div className="empty-text">還沒有成員</div>
            <div className="empty-hint">先加入家人才能開始分帳</div>
            <button className="empty-btn" onClick={onAddMember}>新增成員</button>
          </div>
        ) : (
          <div className="member-grid">
            {members.map(m => {
              const bal = settlement.balances[m.id] || 0;
              return (
                <div key={m.id} className="member-card">
                  <div className="member-avatar">{m.name.charAt(0)}</div>
                  <div className="member-name">{m.name}</div>
                  <div className={`member-bal ${bal > 0.5 ? 'pos' : bal < -0.5 ? 'neg' : ''}`}>
                    {Math.abs(bal) < 0.5 ? '已結清' : (bal > 0 ? `+${formatMoney(bal)}` : `${formatMoney(bal)}`)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {members.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">待結算款項</div>
            {settlement.transfers.length > 1 && (
              <button className="head-action" onClick={onSettleAll}>
                <Sparkles size={14} />
                一鍵結清
              </button>
            )}
          </div>
          {settlement.transfers.length === 0 ? (
            <div className="empty empty-mini">
              <div className="empty-emoji">✨</div>
              <div className="empty-text">大家都結清了</div>
            </div>
          ) : (
            <div className="transfer-list">
              {settlement.transfers.map((t, i) => (
                <TransferCard key={i} transfer={t} members={members} onSettleOne={onSettleOne} />
              ))}
            </div>
          )}
        </div>
      )}

      {settlementHistory.length > 0 && (
        <div className="section">
          <button className="history-btn" onClick={onShowHistory}>
            <History size={16} />
            <span>查看還款記錄 ({settlementHistory.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}

function SettleModal({ members, preset, onClose, onSubmit }) {
  // 是否從待結算款項進來(有 preset 表示是)
  const hasPreset = !!preset;
  const presetAmount = preset?.amount ? Math.round(preset.amount) : 0;

  const [fromId, setFromId] = useState(preset?.fromId || members[0]?.id || '');
  const [toId, setToId] = useState(preset?.toId || members[1]?.id || members[0]?.id || '');
  // 還款模式:'full'(全部結清) 或 'partial'(部分還款)
  // 從待結算進來時預設「部分還款」,因為使用者大多想自己輸入金額
  const [settleMode, setSettleMode] = useState(hasPreset ? 'partial' : 'partial');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // 切換模式時自動處理金額
  useEffect(() => {
    if (settleMode === 'full' && hasPreset) {
      setAmount(presetAmount.toString());
    } else if (settleMode === 'partial') {
      // 切換到部分時清空,讓使用者主動輸入
      setAmount('');
    }
  }, [settleMode, hasPreset, presetAmount]);

  const currentAmount = Number(amount) || 0;
  const remaining = hasPreset ? Math.max(0, presetAmount - currentAmount) : 0;
  const isOverpay = hasPreset && currentAmount > presetAmount;

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { alert('請輸入金額'); return; }
    if (!fromId || !toId) { alert('請選擇還款人和收款人'); return; }
    if (fromId === toId) { alert('還款人和收款人不能是同一人'); return; }

    // 超額還款確認
    if (isOverpay) {
      const extra = currentAmount - presetAmount;
      if (!confirm(`還款金額(NT$ ${formatMoney(currentAmount)})比應還金額(NT$ ${formatMoney(presetAmount)})多出 NT$ ${formatMoney(extra)},確定要繼續嗎?\n\n(多還的部分會變成對方欠你)`)) {
        return;
      }
    }

    onSubmit({
      type: 'settlement',
      amount: amt,
      fromId, toId,
      note: note.trim(),
      date: new Date(date).toISOString(),
    });
  };

  const fromMember = members.find(m => m.id === fromId);
  const toMember = members.find(m => m.id === toId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">記錄還款</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* 從待結算進來:顯示應還總額卡片 */}
          {hasPreset && (
            <div className="settle-summary-card">
              <div className="settle-summary-row">
                <div className="settle-summary-from">{fromMember?.name || '?'}</div>
                <div className="settle-summary-arrow">→</div>
                <div className="settle-summary-to">{toMember?.name || '?'}</div>
              </div>
              <div className="settle-summary-total">
                <span className="settle-summary-label">應還總額</span>
                <span className="settle-summary-amount">NT$ {formatMoney(presetAmount)}</span>
              </div>
            </div>
          )}

          {!hasPreset && (
            <div className="settle-hint">
              <HandCoins size={16} />
              <span>誰把錢還給誰?這會自動更新分帳結算。</span>
            </div>
          )}

          {/* 沒有 preset 才顯示成員選擇 */}
          {!hasPreset && (
            <>
              <div className="field">
                <label className="field-label">還款人(付錢的)</label>
                <div className="payer-row">
                  {members.map(m => (
                    <button key={m.id} className={`payer-btn ${fromId === m.id ? 'active' : ''}`} onClick={() => setFromId(m.id)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">收款人(收錢的)</label>
                <div className="payer-row">
                  {members.map(m => (
                    <button key={m.id}
                      className={`payer-btn ${toId === m.id ? 'active green' : ''}`}
                      onClick={() => setToId(m.id)}
                      disabled={m.id === fromId}
                      style={m.id === fromId ? { opacity: 0.3 } : {}}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 還款方式選擇(只在從待結算進來時顯示) */}
          {hasPreset && (
            <div className="field">
              <label className="field-label">還款方式</label>
              <div className="settle-mode-grid">
                <button
                  className={`settle-mode-btn ${settleMode === 'full' ? 'active' : ''}`}
                  onClick={() => setSettleMode('full')}
                >
                  <div className="settle-mode-icon">✓</div>
                  <div className="settle-mode-title">全部結清</div>
                  <div className="settle-mode-amount">NT$ {formatMoney(presetAmount)}</div>
                </button>
                <button
                  className={`settle-mode-btn ${settleMode === 'partial' ? 'active' : ''}`}
                  onClick={() => setSettleMode('partial')}
                >
                  <div className="settle-mode-icon">$</div>
                  <div className="settle-mode-title">部分還款</div>
                  <div className="settle-mode-amount">自行輸入</div>
                </button>
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">
              {settleMode === 'full' ? '結清金額' : '還款金額'}
            </label>
            <div className={`amount-input ${isOverpay ? 'warn' : ''}`}>
              <span className="amount-prefix">NT$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                autoFocus={!hasPreset || settleMode === 'partial'}
                disabled={settleMode === 'full' && hasPreset}
              />
            </div>

            {/* 即時顯示還款後剩餘 */}
            {hasPreset && currentAmount > 0 && (
              <div className={`settle-preview ${isOverpay ? 'warn' : remaining === 0 ? 'done' : ''}`}>
                {isOverpay ? (
                  <span>⚠️ 超額還款 NT$ {formatMoney(currentAmount - presetAmount)}(對方將會欠你)</span>
                ) : remaining === 0 ? (
                  <span>✨ 還款後將完全結清</span>
                ) : (
                  <span>還款後剩餘:NT$ <strong>{formatMoney(remaining)}</strong> 未還</span>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">日期</label>
            <input type="date" className="date-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="field">
            <label className="field-label">備註(選填)</label>
            <input type="text" className="note-input" value={note} onChange={e => setNote(e.target.value)} placeholder="例如:現金、轉帳..." maxLength={30} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-submit" onClick={submit}>
            {settleMode === 'full' ? '確認結清' : '確認還款'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ history, members, onClose, onDelete }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">還款記錄</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {history.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">📭</div>
              <div className="empty-text">還沒有還款記錄</div>
            </div>
          ) : (
            <div className="history-list">
              {history.map(t => {
                const from = members.find(m => m.id === t.fromId);
                const to = members.find(m => m.id === t.toId);
                return (
                  <div key={t.id} className="history-item">
                    <div className="history-icon"><HandCoins size={16} /></div>
                    <div className="history-mid">
                      <div className="history-top">
                        <span className="history-from">{from?.name || '?'}</span>
                        <span className="history-arrow">→</span>
                        <span className="history-to">{to?.name || '?'}</span>
                      </div>
                      <div className="history-meta">
                        {formatFullDate(t.date)}
                        {t.note && <span> · {t.note}</span>}
                      </div>
                    </div>
                    <div className="history-right">
                      <div className="history-amt">NT$ {formatMoney(t.amount)}</div>
                      <button className="txn-del visible" onClick={() => onDelete(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-submit btn-full" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}

// 成員月明細 Modal
function MemberDetailModal({ detail, monthLabel, onClose }) {
  const { member, stat, list } = detail;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <span className="md-avatar">{member.name.charAt(0)}</span>
            {member.name} · {monthLabel}付款
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* 總額卡片 */}
          <div className="md-summary">
            <div className="md-summary-label">{monthLabel}共付款</div>
            <div className="md-summary-num">NT$ {formatMoney(stat?.total || 0)}</div>
            <div className="md-summary-meta">{stat?.count || 0} 筆消費</div>
          </div>

          {/* 分類分佈 */}
          {stat && stat.catList.length > 0 && (
            <div className="field">
              <label className="field-label">分類分佈</label>
              <div className="cat-list" style={{ boxShadow: 'none', border: '1px solid var(--line-soft)' }}>
                {stat.catList.map(c => {
                  const pct = (c.amount / stat.total) * 100;
                  return (
                    <div key={c.id} className="cat-item">
                      <div className="cat-row">
                        <div className="cat-name">
                          <span className="cat-emoji">{c.emoji}</span>
                          <span>{c.name}</span>
                        </div>
                        <div className="cat-amt">
                          <span className="cat-money">{formatMoney(c.amount)}</span>
                          <span className="cat-pct">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="cat-bar">
                        <div className="cat-fill" style={{ width: `${pct}%`, background: c.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 全部明細 */}
          <div className="field">
            <label className="field-label">付款明細 ({list.length} 筆)</label>
            {list.length === 0 ? (
              <div className="empty empty-mini">
                <div className="empty-emoji">📭</div>
                <div className="empty-text">沒有付款記錄</div>
              </div>
            ) : (
              <div className="md-txn-list">
                {list.map(t => {
                  const cat = CATEGORIES.expense.find(c => c.id === t.category);
                  return (
                    <div key={t.id} className="md-txn-item">
                      <div className="md-txn-icon" style={{ background: (cat?.color || '#999') + '22', color: cat?.color || '#999' }}>
                        {cat?.emoji || '📝'}
                      </div>
                      <div className="md-txn-mid">
                        <div className="md-txn-top">
                          {cat?.name || '其他'}
                          {t.note && <span className="txn-note"> · {t.note}</span>}
                        </div>
                        <div className="md-txn-meta">
                          {formatFullDate(t.date)}
                          {t.shareIds && t.shareIds.length > 1 && <span> · {t.shareIds.length} 人分</span>}
                        </div>
                      </div>
                      <div className="md-txn-amt">NT$ {formatMoney(t.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-submit btn-full" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}

function AddTxnModal({ members, onClose, onSubmit, onAddMember }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState(members[0]?.id || '');
  const [shareIds, setShareIds] = useState(members.map(m => m.id));

  useEffect(() => {
    if (members.length > 0 && !payerId) {
      setPayerId(members[0].id);
      setShareIds(members.map(m => m.id));
    }
  }, [members]);

  useEffect(() => {
    setCategory(type === 'expense' ? 'food' : 'salary');
  }, [type]);

  const cats = type === 'expense' ? CATEGORIES.expense : CATEGORIES.income;

  const toggleShare = (id) => {
    setShareIds(shareIds.includes(id) ? shareIds.filter(x => x !== id) : [...shareIds, id]);
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { alert('請輸入金額'); return; }
    if (members.length > 0 && !payerId) { alert('請選擇付款人'); return; }
    onSubmit({
      type, amount: amt, category, note: note.trim(),
      date: new Date(date).toISOString(),
      payerId: payerId || null,
      shareIds: type === 'expense' ? shareIds : [],
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">新增記錄</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="type-toggle">
            <button className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => setType('expense')}>支出</button>
            <button className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => setType('income')}>收入</button>
          </div>
          <div className="field">
            <label className="field-label">金額</label>
            <div className="amount-input">
              <span className="amount-prefix">NT$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="decimal" autoFocus />
            </div>
          </div>
          <div className="field">
            <label className="field-label">分類</label>
            <div className="cat-grid">
              {cats.map(c => (
                <button key={c.id} className={`cat-chip ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
                  style={category === c.id ? { background: c.color, borderColor: c.color } : {}}>
                  <span className="chip-emoji">{c.emoji}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">日期</label>
            <input type="date" className="date-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">備註(選填)</label>
            <input type="text" className="note-input" value={note} onChange={e => setNote(e.target.value)} placeholder="例如:晚餐、加油..." maxLength={30} />
          </div>
          {members.length === 0 ? (
            <div className="field">
              <button className="empty-member-btn" onClick={onAddMember}>
                <UserPlus size={14} />
                先新增成員以使用分帳功能
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label className="field-label">付款人</label>
                <div className="payer-row">
                  {members.map(m => (
                    <button key={m.id} className={`payer-btn ${payerId === m.id ? 'active' : ''}`} onClick={() => setPayerId(m.id)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              {type === 'expense' && (
                <div className="field">
                  <label className="field-label">由誰分攤</label>
                  <div className="share-row">
                    {members.map(m => (
                      <button key={m.id} className={`share-btn ${shareIds.includes(m.id) ? 'active' : ''}`} onClick={() => toggleShare(m.id)}>
                        {shareIds.includes(m.id) && <Check size={12} />}
                        <span>{m.name}</span>
                      </button>
                    ))}
                  </div>
                  {shareIds.length > 0 && amount && (
                    <div className="share-hint">每人分攤 NT$ {formatMoney(Number(amount) / shareIds.length)}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-submit" onClick={submit}>儲存</button>
        </div>
      </div>
    </div>
  );
}

// 編輯記錄 Modal
function AddMemberModal({ members, onClose, onAdd, onRemove }) {
  const [name, setName] = useState('');
  const submit = () => { if (!name.trim()) return; onAdd(name); setName(''); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-small" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">家庭成員</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">新增成員</label>
            <div className="add-member-row">
              <input type="text" className="note-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="輸入名字..." maxLength={10}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
              <button className="add-btn" onClick={submit}><Plus size={16} /></button>
            </div>
          </div>

          {members.length > 0 && (
            <div className="field">
              <label className="field-label">目前成員 ({members.length})</label>
              <div className="member-mgmt-list">
                {members.map(m => (
                  <div key={m.id} className="member-mgmt-item">
                    <div className="member-mgmt-avatar">{m.name.charAt(0)}</div>
                    <div className="member-mgmt-name">{m.name}</div>
                    <button className="member-mgmt-del"
                      onClick={() => { if (confirm(`確定要移除 ${m.name}?`)) onRemove(m.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-submit btn-full" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap');

  :root {
    --bg: #FAF6F0; --bg-warm: #F5EFE5; --paper: #FFFFFF;
    --ink: #2B2520; --ink-soft: #6B5F55; --ink-mute: #A89B8E;
    --line: #E8DFD2; --line-soft: #F0E8DA;
    --accent: #C97B3F; --accent-soft: #E8956C;
    --green: #7AA095; --red: #B85C5C; --blue: #6B8FB5;
    --shadow-sm: 0 1px 2px rgba(78, 60, 42, 0.06);
    --shadow-md: 0 4px 14px rgba(78, 60, 42, 0.08);
    --shadow-lg: 0 12px 32px rgba(78, 60, 42, 0.14);
    --r-sm: 10px; --r-md: 14px; --r-lg: 20px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; }

  .ledger-app {
    min-height: 100vh; background: var(--bg);
    font-family: 'Noto Sans TC', system-ui, -apple-system, sans-serif;
    color: var(--ink); -webkit-font-smoothing: antialiased;
    padding-bottom: 110px; position: relative;
  }
  .ledger-app::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 15% 10%, rgba(232, 149, 108, 0.06) 0%, transparent 40%),
      radial-gradient(circle at 85% 80%, rgba(122, 160, 149, 0.05) 0%, transparent 40%);
    pointer-events: none; z-index: 0;
  }

  .ledger-loading { min-height: 100vh; display: grid; place-items: center; background: var(--bg); font-family: 'Noto Serif TC', serif; color: var(--ink-soft); }
  .loading-glow { font-size: 16px; letter-spacing: 0.1em; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .ledger-header { position: sticky; top: 0; z-index: 10; background: rgba(250, 246, 240, 0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
  .header-inner { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; max-width: 600px; margin: 0 auto; }
  .header-actions { display: flex; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%); color: white; display: grid; place-items: center; font-family: 'Noto Serif TC', serif; font-weight: 700; font-size: 18px; box-shadow: var(--shadow-sm); }
  .brand-title { font-family: 'Noto Serif TC', serif; font-weight: 700; font-size: 16px; color: var(--ink); line-height: 1.2; }
  .brand-sub { font-size: 11px; color: var(--ink-mute); letter-spacing: 0.05em; margin-top: 2px; }
  .brand-text { min-width: 0; }

  /* === MONTH SWITCHER === */
  .month-switcher {
    display: flex; align-items: center; gap: 2px;
    margin-top: 2px;
  }
  .month-nav-btn {
    width: 22px; height: 22px;
    border-radius: 6px;
    border: none; background: transparent;
    color: var(--ink-mute);
    cursor: pointer;
    display: grid; place-items: center;
    transition: all 0.15s;
  }
  .month-nav-btn:hover:not(:disabled) { background: var(--bg-warm); color: var(--accent); }
  .month-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .month-label-btn {
    background: none; border: none;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 11px;
    color: var(--ink-mute);
    letter-spacing: 0.05em;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .month-label-btn:hover { color: var(--accent); background: var(--bg-warm); }
  .month-label-btn.past { color: var(--accent); font-weight: 500; }
  .back-now { color: var(--ink-mute); font-size: 10px; }

  .past-badge {
    position: absolute; top: 14px; right: 16px;
    background: rgba(232, 149, 108, 0.2);
    color: #E8956C;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 100px;
    letter-spacing: 0.05em;
    font-weight: 500;
    z-index: 2;
  }
  .balance-card.past { background: linear-gradient(135deg, #3D3024 0%, #4D3D2E 100%); }
  .past-badge-mini {
    display: inline-block;
    background: rgba(232, 149, 108, 0.15);
    color: var(--accent);
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 100px;
    letter-spacing: 0.05em;
    font-weight: 500;
    margin-bottom: 10px;
  }
  .stats-summary.past { border-color: rgba(232, 149, 108, 0.3); }

  /* === SUBTAB === */
  .subtab-bar {
    display: flex;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 4px;
    margin-bottom: 18px;
    box-shadow: var(--shadow-sm);
  }
  .subtab-btn {
    flex: 1; padding: 10px;
    background: none; border: none;
    border-radius: 8px;
    font-family: inherit; font-size: 13px; font-weight: 500;
    color: var(--ink-mute);
    cursor: pointer;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .subtab-btn.active { background: var(--ink); color: white; }

  /* === MEMBER STAT === */
  .member-stat-list { display: flex; flex-direction: column; gap: 12px; }
  .member-stat-card {
    background: var(--paper);
    border: 1px solid var(--line-soft);
    border-radius: var(--r-md);
    padding: 16px;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s;
    width: 100%;
  }
  .member-stat-card:hover:not(:disabled) {
    border-color: var(--accent);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  .member-stat-card:disabled { cursor: default; opacity: 0.6; }
  .member-stat-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .member-stat-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%);
    color: white;
    display: grid; place-items: center;
    font-family: 'Noto Serif TC', serif;
    font-weight: 600;
    font-size: 16px;
    flex-shrink: 0;
  }
  .member-stat-info { flex: 1; min-width: 0; }
  .member-stat-name { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
  .member-stat-meta { font-size: 11px; color: var(--ink-mute); }
  .member-stat-amt {
    font-family: 'Noto Serif TC', serif;
    font-weight: 600; font-size: 18px;
    color: var(--ink);
    flex-shrink: 0;
  }
  .member-stat-bar {
    height: 5px;
    background: var(--bg-warm);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .member-stat-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(to right, var(--accent), var(--accent-soft));
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .member-stat-cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .member-stat-cat {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 8px;
    background: var(--bg-warm);
    border-radius: 100px;
    font-size: 11px;
    color: var(--ink-soft);
  }
  .member-stat-cat.more { color: var(--ink-mute); }
  .msc-emoji { font-size: 12px; }
  .msc-name { font-weight: 500; }
  .msc-amt { font-family: 'Noto Serif TC', serif; color: var(--ink); font-weight: 600; }

  /* === MEMBER DETAIL MODAL === */
  .md-avatar {
    display: inline-grid; place-items: center;
    width: 28px; height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%);
    color: white;
    font-family: 'Noto Serif TC', serif;
    font-weight: 600;
    font-size: 13px;
    margin-right: 8px;
    vertical-align: middle;
  }
  .md-summary {
    background: linear-gradient(135deg, #2B2520 0%, #3D2F22 100%);
    border-radius: var(--r-md);
    padding: 20px;
    margin-bottom: 18px;
    color: #F5EFE5;
    text-align: center;
  }
  .md-summary-label { font-size: 11px; color: rgba(245, 239, 229, 0.6); letter-spacing: 0.1em; margin-bottom: 6px; }
  .md-summary-num { font-family: 'Noto Serif TC', serif; font-size: 28px; font-weight: 600; color: #F5EFE5; margin-bottom: 4px; }
  .md-summary-meta { font-size: 12px; color: rgba(245, 239, 229, 0.6); }

  .md-txn-list { display: flex; flex-direction: column; gap: 6px; }
  .md-txn-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    background: var(--paper);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
  }
  .md-txn-icon {
    width: 32px; height: 32px;
    border-radius: 9px;
    display: grid; place-items: center;
    font-size: 15px;
    flex-shrink: 0;
  }
  .md-txn-mid { flex: 1; min-width: 0; }
  .md-txn-top { font-size: 13px; color: var(--ink); font-weight: 500; margin-bottom: 2px; }
  .md-txn-meta { font-size: 11px; color: var(--ink-mute); }
  .md-txn-amt {
    font-family: 'Noto Serif TC', serif;
    font-weight: 600; font-size: 14px;
    color: var(--ink); flex-shrink: 0;
  }

  .sync-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--paper); color: var(--ink-soft); cursor: pointer; display: grid; place-items: center; transition: all 0.2s; position: relative; }
  .sync-btn:hover, .sync-btn.active { border-color: var(--accent); color: var(--accent); }
  .sync-btn.syncing svg { animation: spin 0.6s linear; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .search-dot { position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); border: 2px solid var(--paper); }

  .ledger-main { max-width: 600px; margin: 0 auto; padding: 20px 18px; position: relative; z-index: 1; }

  /* === SEARCH PANEL === */
  .search-panel {
    background: var(--paper);
    border-radius: var(--r-md);
    padding: 14px;
    margin-bottom: 18px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--line-soft);
    animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideDown { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .search-input-wrap {
    position: relative;
    display: flex; align-items: center;
    background: var(--bg-warm); border: 1px solid var(--line);
    border-radius: var(--r-sm); padding: 0 14px;
    transition: border-color 0.2s;
  }
  .search-input-wrap:focus-within { border-color: var(--accent); }
  .search-icon { color: var(--ink-mute); flex-shrink: 0; }
  .search-input { flex: 1; border: none; outline: none; background: none; padding: 12px 10px; font-family: inherit; font-size: 14px; color: var(--ink); }
  .search-input::placeholder { color: var(--ink-mute); }
  .search-clear { background: none; border: none; padding: 4px; cursor: pointer; color: var(--ink-mute); display: grid; place-items: center; }

  .search-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .filter-chips { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; }
  .filter-chip {
    padding: 6px 12px; border-radius: 100px;
    background: var(--bg-warm); border: 1px solid var(--line);
    font-family: inherit; font-size: 12px; color: var(--ink-soft);
    cursor: pointer; transition: all 0.15s;
  }
  .filter-chip.active { background: var(--ink); border-color: var(--ink); color: white; }
  .adv-toggle {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 10px; border-radius: 100px;
    background: var(--bg-warm); border: 1px solid var(--line);
    font-family: inherit; font-size: 12px; color: var(--ink-soft);
    cursor: pointer; flex-shrink: 0;
  }
  .adv-toggle.active { background: var(--accent); border-color: var(--accent); color: white; }

  .advanced-filters {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line-soft);
    display: flex; flex-direction: column; gap: 16px;
  }
  .filter-group { }
  .filter-label { font-size: 11px; color: var(--ink-soft); margin-bottom: 8px; letter-spacing: 0.06em; font-weight: 500; }

  .filter-cat-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px;
  }
  .filter-cat-chip {
    background: var(--bg-warm); border: 1px solid var(--line);
    border-radius: 8px; padding: 8px 4px;
    cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-family: inherit; font-size: 11px; color: var(--ink);
    transition: all 0.15s;
  }
  .filter-cat-chip:hover { border-color: var(--ink-mute); }
  .filter-cat-chip > span:first-child { font-size: 16px; }

  .filter-payer-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .filter-payer-chip {
    background: var(--bg-warm); border: 1px solid var(--line);
    border-radius: 100px; padding: 6px 12px;
    font-family: inherit; font-size: 12px; color: var(--ink-soft);
    cursor: pointer; transition: all 0.15s;
  }
  .filter-payer-chip.active { background: var(--accent); border-color: var(--accent); color: white; }

  .filter-quick-date { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .quick-date-btn {
    padding: 5px 10px; border-radius: 100px;
    background: var(--bg-warm); border: 1px solid var(--line);
    font-family: inherit; font-size: 11px; color: var(--ink-soft);
    cursor: pointer; transition: all 0.15s;
  }
  .quick-date-btn:hover { border-color: var(--accent); color: var(--accent); }

  .filter-date-row, .filter-amount-row { display: flex; align-items: center; gap: 8px; }
  .filter-date-input, .filter-amount-input {
    flex: 1; min-width: 0;
    background: var(--bg-warm); border: 1px solid var(--line);
    border-radius: 8px; padding: 8px 10px;
    font-family: inherit; font-size: 13px; color: var(--ink);
    outline: none; transition: border-color 0.2s;
  }
  .filter-date-input:focus, .filter-amount-input:focus { border-color: var(--accent); }
  .filter-date-sep { font-size: 12px; color: var(--ink-mute); flex-shrink: 0; }

  .search-actions {
    display: flex; gap: 8px; margin-top: 14px;
    padding-top: 12px; border-top: 1px solid var(--line-soft);
    justify-content: flex-end;
  }
  .search-clear-btn, .search-close-btn {
    padding: 8px 14px; border-radius: 8px;
    font-family: inherit; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .search-clear-btn {
    background: var(--bg-warm); border: 1px solid var(--line); color: var(--red);
  }
  .search-close-btn {
    background: var(--ink); border: none; color: white;
  }

  /* === SEARCH RESULT === */
  .tab-search-result { animation: fadeIn 0.2s; }
  .result-summary {
    background: var(--paper); border-radius: var(--r-md);
    padding: 16px; margin-bottom: 16px;
    border: 1px solid var(--line-soft); box-shadow: var(--shadow-sm);
  }
  .result-count { font-size: 13px; color: var(--ink-soft); margin-bottom: 8px; }
  .result-count strong { font-family: 'Noto Serif TC', serif; color: var(--accent); font-size: 16px; }
  .result-stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .result-stat {
    font-family: 'Noto Serif TC', serif; font-size: 13px; font-weight: 500;
    padding: 4px 10px; border-radius: 6px;
  }
  .result-stat.income { color: var(--green); background: rgba(122, 160, 149, 0.1); }
  .result-stat.expense { color: var(--red); background: rgba(184, 92, 92, 0.1); }
  .result-stat.net { color: var(--ink); background: var(--bg-warm); }
  .result-stat.net.neg { color: var(--red); }

  /* === REST (same as before) === */
  .balance-card { position: relative; background: linear-gradient(135deg, #2B2520 0%, #3D2F22 100%); border-radius: var(--r-lg); padding: 28px 24px; color: #F5EFE5; overflow: hidden; box-shadow: var(--shadow-md); margin-bottom: 28px; }
  .balance-bg { position: absolute; inset: 0; background-image: radial-gradient(circle at 80% 0%, rgba(232, 149, 108, 0.18) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(122, 160, 149, 0.12) 0%, transparent 50%); pointer-events: none; }
  .balance-label { font-size: 12px; letter-spacing: 0.15em; color: rgba(245, 239, 229, 0.6); text-transform: uppercase; position: relative; }
  .balance-num { font-family: 'Noto Serif TC', serif; font-size: 36px; font-weight: 600; margin: 8px 0 24px; letter-spacing: -0.01em; position: relative; }
  .balance-num.neg { color: #E8956C; }
  .balance-row { display: flex; align-items: center; gap: 16px; position: relative; }
  .balance-cell { flex: 1; }
  .cell-label { font-size: 11px; color: rgba(245, 239, 229, 0.55); letter-spacing: 0.08em; margin-bottom: 4px; }
  .cell-num { font-family: 'Noto Serif TC', serif; font-size: 20px; font-weight: 600; }
  .cell-num.income { color: #9DBFB3; }
  .cell-num.expense { color: #E8956C; }
  .cell-divider { width: 1px; height: 28px; background: rgba(245, 239, 229, 0.15); }

  .section { margin-bottom: 28px; }
  .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 0 4px; }
  .section-title { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 15px; color: var(--ink); letter-spacing: 0.02em; }
  .section-count, .section-deco { font-size: 12px; color: var(--ink-mute); }
  .head-action { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--accent); font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 500; padding: 6px 10px; border-radius: 8px; transition: background 0.15s; }
  .head-action:hover { background: rgba(201, 123, 63, 0.08); }

  .empty { background: var(--paper); border: 1px dashed var(--line); border-radius: var(--r-md); padding: 40px 20px; text-align: center; }
  .empty-mini { padding: 24px 20px; }
  .empty-emoji { font-size: 32px; margin-bottom: 10px; }
  .empty-text { font-size: 14px; color: var(--ink-soft); font-weight: 500; }
  .empty-hint { font-size: 12px; color: var(--ink-mute); margin-top: 4px; }
  .empty-btn { margin-top: 14px; background: var(--accent); color: white; border: none; padding: 8px 18px; border-radius: var(--r-sm); font-family: inherit; font-size: 13px; cursor: pointer; font-weight: 500; }

  .txn-list { background: var(--paper); border-radius: var(--r-md); overflow: hidden; box-shadow: var(--shadow-sm); }
  .txn-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line-soft); transition: background 0.15s; }
  .txn-item:last-child { border-bottom: none; }
  .txn-item:hover { background: var(--bg-warm); }
  .txn-icon { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font-size: 18px; flex-shrink: 0; }
  .txn-icon.settle-icon { background: rgba(107, 143, 181, 0.15); color: var(--blue); }
  .txn-mid { flex: 1; min-width: 0; }
  .txn-top { font-size: 14px; color: var(--ink); font-weight: 500; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txn-cat { font-weight: 600; }
  .txn-note { color: var(--ink-soft); font-weight: 400; }
  .txn-meta { font-size: 11px; color: var(--ink-mute); }
  .txn-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .txn-amt { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 15px; }
  .txn-amt.expense { color: var(--ink); }
  .txn-amt.income { color: var(--green); }
  .txn-amt.settle { color: var(--blue); font-size: 14px; }
  .txn-del { background: none; border: none; color: var(--ink-mute); cursor: pointer; padding: 6px; border-radius: 6px; opacity: 0; transition: all 0.2s; }
  .txn-del.visible { opacity: 1; }
  .txn-item:hover .txn-del { opacity: 1; }
  .txn-del:hover { color: var(--red); background: rgba(184, 92, 92, 0.08); }
  @media (hover: none) { .txn-del { opacity: 0.6; } }

  .stats-summary { background: var(--paper); border-radius: var(--r-lg); padding: 28px 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm); border: 1px solid var(--line-soft); }
  .stats-label { font-size: 12px; color: var(--ink-mute); letter-spacing: 0.1em; }
  .stats-num { font-family: 'Noto Serif TC', serif; font-size: 32px; font-weight: 600; color: var(--ink); margin: 6px 0 4px; }
  .stats-meta { font-size: 12px; color: var(--ink-soft); }

  .cat-list { background: var(--paper); border-radius: var(--r-md); padding: 6px; box-shadow: var(--shadow-sm); }
  .cat-item { padding: 12px 14px; }
  .cat-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .cat-name { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ink); font-weight: 500; }
  .cat-emoji { font-size: 18px; }
  .cat-amt { display: flex; align-items: baseline; gap: 8px; }
  .cat-money { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 14px; color: var(--ink); }
  .cat-pct { font-size: 11px; color: var(--ink-mute); min-width: 30px; text-align: right; }
  .cat-bar { height: 6px; background: var(--bg-warm); border-radius: 3px; overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

  .member-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .member-card { background: var(--paper); border-radius: var(--r-md); padding: 18px 14px; text-align: center; box-shadow: var(--shadow-sm); border: 1px solid var(--line-soft); }
  .member-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%); color: white; display: grid; place-items: center; margin: 0 auto 10px; font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 18px; }
  .member-name { font-size: 14px; font-weight: 500; color: var(--ink); margin-bottom: 4px; }
  .member-bal { font-family: 'Noto Serif TC', serif; font-size: 13px; color: var(--ink-mute); font-weight: 500; }
  .member-bal.pos { color: var(--green); }
  .member-bal.neg { color: var(--red); }

  .transfer-list { display: flex; flex-direction: column; gap: 10px; }
  .transfer-card { background: var(--paper); border-radius: var(--r-md); padding: 14px 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--line-soft); }
  .transfer-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .transfer-from, .transfer-to { font-weight: 600; font-size: 14px; }
  .transfer-from { color: var(--red); }
  .transfer-to { color: var(--green); }
  .transfer-arrow { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .arrow-line { width: 100%; height: 1px; background: linear-gradient(to right, var(--red), var(--green)); position: relative; }
  .arrow-line::after { content: '→'; position: absolute; right: -2px; top: -10px; color: var(--green); font-size: 14px; }
  .arrow-amt { font-family: 'Noto Serif TC', serif; font-size: 12px; color: var(--ink-soft); font-weight: 500; }

  .settle-btn { width: 100%; padding: 10px; border-radius: 8px; background: var(--bg-warm); border: 1px solid var(--line); color: var(--accent); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; }
  .settle-btn:hover { background: var(--accent); border-color: var(--accent); color: white; }
  .settle-btn:active { transform: scale(0.98); }

  .history-btn { width: 100%; padding: 14px; border-radius: var(--r-md); background: var(--paper); border: 1px solid var(--line-soft); color: var(--ink-soft); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: var(--shadow-sm); transition: all 0.15s; }
  .history-btn:hover { color: var(--accent); border-color: var(--accent); }

  .history-list { display: flex; flex-direction: column; gap: 8px; }
  .history-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--paper); border: 1px solid var(--line-soft); border-radius: var(--r-sm); }
  .history-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: rgba(107, 143, 181, 0.15); color: var(--blue); flex-shrink: 0; }
  .history-mid { flex: 1; min-width: 0; }
  .history-top { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .history-from { color: var(--red); }
  .history-to { color: var(--green); }
  .history-arrow { color: var(--ink-mute); }
  .history-meta { font-size: 11px; color: var(--ink-mute); }
  .history-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .history-amt { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 14px; color: var(--ink); }

  .settle-hint { display: flex; align-items: center; gap: 8px; padding: 12px 14px; margin-bottom: 18px; background: rgba(107, 143, 181, 0.08); border-radius: var(--r-sm); color: var(--blue); font-size: 13px; }

  /* === SETTLE MODE === */
  .settle-summary-card {
    background: linear-gradient(135deg, #2B2520 0%, #3D2F22 100%);
    border-radius: var(--r-md);
    padding: 18px 20px;
    margin-bottom: 20px;
    color: #F5EFE5;
    box-shadow: var(--shadow-sm);
  }
  .settle-summary-row {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    margin-bottom: 14px;
  }
  .settle-summary-from, .settle-summary-to {
    font-family: 'Noto Serif TC', serif;
    font-weight: 600; font-size: 16px;
  }
  .settle-summary-from { color: #E8956C; }
  .settle-summary-to { color: #9DBFB3; }
  .settle-summary-arrow {
    color: rgba(245, 239, 229, 0.5);
    font-size: 18px;
  }
  .settle-summary-total {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid rgba(245, 239, 229, 0.12);
  }
  .settle-summary-label {
    font-size: 11px;
    color: rgba(245, 239, 229, 0.6);
    letter-spacing: 0.1em;
  }
  .settle-summary-amount {
    font-family: 'Noto Serif TC', serif;
    font-weight: 600; font-size: 22px;
    color: #F5EFE5;
  }

  .settle-mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .settle-mode-btn {
    background: var(--paper);
    border: 2px solid var(--line);
    border-radius: var(--r-sm);
    padding: 14px 12px;
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    font-family: inherit;
    transition: all 0.15s;
    text-align: center;
  }
  .settle-mode-btn:hover { border-color: var(--ink-mute); }
  .settle-mode-btn.active {
    border-color: var(--accent);
    background: rgba(201, 123, 63, 0.06);
  }
  .settle-mode-icon {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--bg-warm);
    color: var(--ink-mute);
    display: grid; place-items: center;
    font-family: 'Noto Serif TC', serif;
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 2px;
    transition: all 0.15s;
  }
  .settle-mode-btn.active .settle-mode-icon {
    background: var(--accent);
    color: white;
  }
  .settle-mode-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .settle-mode-amount {
    font-family: 'Noto Serif TC', serif;
    font-size: 12px;
    color: var(--ink-soft);
    font-weight: 500;
  }
  .settle-mode-btn.active .settle-mode-amount {
    color: var(--accent);
  }

  .amount-input.warn { border-color: #E8956C; background: rgba(232, 149, 108, 0.04); }
  .amount-input input:disabled {
    color: var(--ink);
    -webkit-text-fill-color: var(--ink);
    opacity: 1;
    cursor: not-allowed;
  }

  .settle-preview {
    margin-top: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    background: var(--bg-warm);
    color: var(--ink-soft);
    border-left: 3px solid var(--ink-mute);
  }
  .settle-preview strong {
    font-family: 'Noto Serif TC', serif;
    color: var(--accent);
    font-weight: 600;
  }
  .settle-preview.done {
    background: rgba(122, 160, 149, 0.08);
    color: var(--green);
    border-left-color: var(--green);
    font-weight: 500;
  }
  .settle-preview.warn {
    background: rgba(232, 149, 108, 0.08);
    color: #B85C5C;
    border-left-color: #E8956C;
    font-weight: 500;
  }

  .fab { position: fixed; bottom: 86px; right: 50%; transform: translateX(50%); width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, #B5683A 100%); color: white; border: none; cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(201, 123, 63, 0.45), 0 2px 4px rgba(78, 60, 42, 0.2); z-index: 5; transition: all 0.2s; }
  @media (min-width: 600px) { .fab { right: calc(50% - 280px); transform: none; } }
  .fab:hover { transform: translateX(50%) scale(1.05); }
  @media (min-width: 600px) { .fab:hover { transform: scale(1.05); } }
  .fab:active { transform: translateX(50%) scale(0.95); }

  .ledger-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); border-top: 1px solid var(--line); display: flex; z-index: 4; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); }
  .nav-btn { flex: 1; background: none; border: none; padding: 10px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--ink-mute); font-family: inherit; font-size: 11px; cursor: pointer; transition: color 0.15s; }
  .nav-btn.active { color: var(--accent); }
  .nav-btn span { font-weight: 500; letter-spacing: 0.05em; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(43, 37, 32, 0.4); backdrop-filter: blur(4px); display: grid; place-items: end center; z-index: 100; animation: fadeIn 0.2s; }
  @media (min-width: 600px) { .modal-overlay { place-items: center; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal { background: var(--bg); width: 100%; max-width: 500px; max-height: 92vh; border-radius: 24px 24px 0 0; overflow: hidden; display: flex; flex-direction: column; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--shadow-lg); }
  @media (min-width: 600px) { .modal { border-radius: 20px; max-height: 86vh; } }
  .modal-small { max-width: 420px; }
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--line); background: var(--paper); }
  .modal-title { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 17px; color: var(--ink); }
  .modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--bg-warm); color: var(--ink-soft); cursor: pointer; display: grid; place-items: center; }
  .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
  .modal-foot { display: flex; gap: 10px; padding: 16px 20px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--paper); }
  .btn-cancel, .btn-submit { flex: 1; padding: 13px; border-radius: var(--r-sm); font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .btn-cancel { background: var(--bg-warm); color: var(--ink-soft); border: 1px solid var(--line); }
  .btn-submit { background: var(--ink); color: white; border: none; }
  .btn-submit:hover { background: var(--accent); }
  .btn-full { flex: 1; }

  .field { margin-bottom: 18px; }
  .field-label { display: block; font-size: 12px; color: var(--ink-soft); margin-bottom: 8px; letter-spacing: 0.08em; font-weight: 500; }

  .type-toggle { display: flex; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px; margin-bottom: 20px; }
  .type-btn { flex: 1; padding: 10px; background: none; border: none; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ink-mute); cursor: pointer; transition: all 0.2s; }
  .type-btn.active.expense { background: var(--ink); color: white; }
  .type-btn.active.income { background: var(--green); color: white; }

  .amount-input { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 14px 16px; display: flex; align-items: center; gap: 10px; transition: border-color 0.2s; }
  .amount-input:focus-within { border-color: var(--accent); }
  .amount-prefix { font-family: 'Noto Serif TC', serif; font-size: 16px; color: var(--ink-mute); font-weight: 600; }
  .amount-input input { flex: 1; border: none; outline: none; background: none; font-family: 'Noto Serif TC', serif; font-size: 24px; font-weight: 600; color: var(--ink); }

  .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; }
  .cat-chip { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 10px 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: inherit; font-size: 12px; color: var(--ink); transition: all 0.15s; }
  .cat-chip:hover { border-color: var(--ink-mute); }
  .cat-chip.active { color: white; }
  .chip-emoji { font-size: 22px; }

  .date-input, .note-input { width: 100%; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; font-family: inherit; font-size: 14px; color: var(--ink); outline: none; transition: border-color 0.2s; }
  .date-input:focus, .note-input:focus { border-color: var(--accent); }

  .payer-row, .share-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .payer-btn, .share-btn { background: var(--paper); border: 1px solid var(--line); border-radius: 100px; padding: 8px 14px; cursor: pointer; font-family: inherit; font-size: 13px; color: var(--ink-soft); transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px; }
  .payer-btn:hover:not(:disabled), .share-btn:hover { border-color: var(--ink-mute); }
  .payer-btn.active { background: var(--ink); border-color: var(--ink); color: white; }
  .payer-btn.active.green { background: var(--green); border-color: var(--green); color: white; }
  .payer-btn:disabled { cursor: not-allowed; }
  .share-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
  .share-hint { margin-top: 8px; font-size: 12px; color: var(--ink-soft); padding: 8px 12px; background: var(--bg-warm); border-radius: 8px; }

  .empty-member-btn { width: 100%; background: var(--bg-warm); border: 1px dashed var(--line); border-radius: var(--r-sm); padding: 14px; cursor: pointer; color: var(--accent); font-family: inherit; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; }

  .add-member-row { display: flex; gap: 8px; }
  .add-btn { width: 44px; height: 44px; border-radius: var(--r-sm); border: none; background: var(--accent); color: white; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; }

  .member-mgmt-list { background: var(--paper); border-radius: var(--r-sm); border: 1px solid var(--line); overflow: hidden; }
  .member-mgmt-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--line-soft); }
  .member-mgmt-item:last-child { border-bottom: none; }
  .member-mgmt-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%); color: white; display: grid; place-items: center; font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 14px; }
  .member-mgmt-name { flex: 1; font-size: 14px; color: var(--ink); font-weight: 500; }
  .member-mgmt-del { background: none; border: none; color: var(--ink-mute); cursor: pointer; padding: 6px; border-radius: 6px; }
  .member-mgmt-del:hover { color: var(--red); background: rgba(184, 92, 92, 0.08); }

  .share-url { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; font-size: 12px; color: var(--ink-soft); word-break: break-all; font-family: monospace; }

  /* === EDIT BUTTON === */
  .txn-edit {
    background: none; border: none;
    color: var(--ink-mute);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    opacity: 0;
    transition: all 0.2s;
  }
  .txn-item:hover .txn-edit { opacity: 1; }
  .txn-edit:hover { color: var(--blue); background: rgba(107, 143, 181, 0.08); }
  @media (hover: none) { .txn-edit { opacity: 0.6; } }

  /* === SOURCE (欠款來源) === */
  .source-toggle {
    width: 100%;
    background: none;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    padding: 8px;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    margin-bottom: 8px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .source-toggle:hover { background: rgba(201, 123, 63, 0.06); }
  .source-toggle svg { transition: transform 0.2s; }
  .source-toggle svg.rotated { transform: rotate(180deg); }
  .source-note {
    font-size: 11px;
    color: var(--ink-soft);
    line-height: 1.5;
    padding: 8px 10px;
    background: rgba(201, 123, 63, 0.06);
    border-radius: 8px;
    margin-top: 2px;
  }
  .source-note strong { color: var(--accent); font-family: 'Noto Serif TC', serif; }

  .source-list {
    background: var(--bg-warm);
    border-radius: var(--r-sm);
    padding: 12px;
    margin-bottom: 10px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .source-hint {
    font-size: 11px;
    color: var(--ink-soft);
    margin-bottom: 2px;
  }
  .source-item {
    display: flex; align-items: center; gap: 10px;
    background: var(--paper);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .source-icon {
    width: 30px; height: 30px;
    border-radius: 8px;
    display: grid; place-items: center;
    font-size: 14px;
    flex-shrink: 0;
  }
  .source-mid { flex: 1; min-width: 0; }
  .source-top { font-size: 13px; color: var(--ink); font-weight: 500; }
  .source-meta { font-size: 10px; color: var(--ink-mute); }
  .source-amt {
    font-family: 'Noto Serif TC', serif;
    font-weight: 600;
    font-size: 13px;
    color: var(--ink);
    flex-shrink: 0;
  }

  /* === ADMIN / PIN SETTINGS === */
  .member-mgmt-hint {
    font-size: 11px;
    color: var(--ink-mute);
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .admin-tag {
    font-size: 10px;
    color: var(--accent);
    margin-left: 6px;
    font-weight: 500;
  }
  .admin-toggle {
    background: var(--bg-warm);
    border: 1px solid var(--line);
    border-radius: 8px;
    width: 32px; height: 32px;
    cursor: pointer;
    font-size: 14px;
    display: grid; place-items: center;
    filter: grayscale(1) opacity(0.4);
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .admin-toggle.active {
    filter: none;
    background: rgba(201, 123, 63, 0.12);
    border-color: var(--accent);
  }

  .pin-setting-box {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 14px;
  }
  .pin-setting-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
  }
  .pin-setting-info { flex: 1; min-width: 0; }
  .pin-setting-title {
    font-size: 13px; font-weight: 600; color: var(--ink);
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 3px;
  }
  .pin-setting-desc { font-size: 11px; color: var(--ink-mute); line-height: 1.4; }
  .pin-status {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 100px;
    flex-shrink: 0;
  }
  .pin-status.on { background: rgba(122, 160, 149, 0.15); color: var(--green); }
  .pin-status.off { background: var(--bg-warm); color: var(--ink-mute); }

  .pin-setting-actions, .pin-setup-actions {
    display: flex; gap: 8px; margin-top: 12px;
  }
  .pin-action-btn {
    flex: 1;
    padding: 9px;
    border-radius: 8px;
    background: var(--bg-warm);
    border: 1px solid var(--line);
    color: var(--ink-soft);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pin-action-btn:hover { border-color: var(--ink-mute); }
  .pin-action-btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
  .pin-action-btn.danger { color: var(--red); }
  .pin-setup-form { margin-top: 12px; }

  /* === PIN MODAL === */
  .pin-modal { max-width: 360px; }
  .pin-desc {
    text-align: center;
    font-size: 13px;
    color: var(--ink-soft);
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .pin-dots {
    display: flex; justify-content: center; gap: 14px;
    margin-bottom: 16px;
  }
  .pin-dots.error { animation: shake 0.4s; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }
  .pin-dot {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 2px solid var(--line);
    background: transparent;
    transition: all 0.15s;
  }
  .pin-dot.filled {
    background: var(--accent);
    border-color: var(--accent);
  }
  .pin-error {
    text-align: center;
    color: var(--red);
    font-size: 12px;
    margin-bottom: 14px;
  }
  .pin-pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    max-width: 260px;
    margin: 8px auto 0;
  }
  .pin-key {
    aspect-ratio: 1.4;
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    background: var(--paper);
    font-family: 'Noto Serif TC', serif;
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
    transition: all 0.1s;
  }
  .pin-key:hover { background: var(--bg-warm); border-color: var(--accent); }
  .pin-key:active { transform: scale(0.95); background: var(--accent); color: white; }
  .pin-key.empty { border: none; background: none; cursor: default; }
  .pin-key.back { font-size: 18px; color: var(--ink-soft); }
`;

