import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, Home, PieChart, ArrowLeftRight, X, Check, UserPlus, Sparkles, Share2 } from 'lucide-react';
import { loadData, saveData, subscribeToChanges, familyId } from './firebase.js';

// 分類設定
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

const formatMoney = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const monthKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentMonthLabel = () => {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
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

  // 啟動時載入並開始即時同步
  useEffect(() => {
    let unsub = null;
    (async () => {
      const data = await loadData();
      setMembers(data.members);
      setTxns(data.txns);
      setLoading(false);

      // 訂閱即時更新:其他家人改了什麼,我這邊自動同步
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
    if (txns.some(t => t.payerId === id || (t.shareIds && t.shareIds.includes(id)))) {
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

  const removeTxn = async (id) => {
    const newTxns = txns.filter(t => t.id !== id);
    setTxns(newTxns);
    await saveData(members, newTxns);
  };

  const thisMonth = monthKey(new Date().toISOString());
  const monthTxns = useMemo(() => txns.filter(t => monthKey(t.date) === thisMonth), [txns, thisMonth]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    const catMap = {};
    monthTxns.forEach(t => {
      if (t.type === 'income') {
        income += Number(t.amount);
      } else {
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

  const settlement = useMemo(() => {
    const balances = {};
    members.forEach(m => { balances[m.id] = 0; });

    txns.forEach(t => {
      if (t.type !== 'expense' || !t.shareIds || t.shareIds.length === 0) return;
      const amt = Number(t.amount);
      const share = amt / t.shareIds.length;
      if (balances[t.payerId] !== undefined) balances[t.payerId] += amt;
      t.shareIds.forEach(sid => {
        if (balances[sid] !== undefined) balances[sid] -= share;
      });
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

    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amt = Math.min(d.amount, c.amount);
      if (amt > 0.5) transfers.push({ from: d.name, to: c.name, amount: amt });
      d.amount -= amt;
      c.amount -= amt;
      if (d.amount < 0.5) i++;
      if (c.amount < 0.5) j++;
    }

    return { balances, transfers };
  }, [txns, members]);

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
            <div>
              <div className="brand-title">家庭記帳本</div>
              <div className="brand-sub">{currentMonthLabel()}</div>
            </div>
          </div>
          <div className="header-actions">
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
          <HomeTab stats={stats} txns={txns} monthTxns={monthTxns} members={members} onDelete={removeTxn} />
        )}
        {tab === 'stats' && <StatsTab stats={stats} monthTxns={monthTxns} />}
        {tab === 'split' && (
          <SplitTab
            members={members}
            settlement={settlement}
            onAddMember={() => setShowAddMember(true)}
            onRemoveMember={removeMember}
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
    </div>
  );
}

// 分享 Modal:讓家人加入同一本帳
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

// 首頁
function HomeTab({ stats, monthTxns, members, onDelete }) {
  const recent = monthTxns.slice(0, 50);
  return (
    <div className="tab-home">
      <div className="balance-card">
        <div className="balance-bg" />
        <div className="balance-label">本月結餘</div>
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
          <div className="section-title">本月記錄</div>
          <div className="section-count">{monthTxns.length} 筆</div>
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🌱</div>
            <div className="empty-text">這個月還沒有記錄</div>
            <div className="empty-hint">點右下角 + 開始記帳</div>
          </div>
        ) : (
          <div className="txn-list">
            {recent.map(t => {
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
                    <button className="txn-del" onClick={() => { if (confirm('確定要刪除這筆記錄?')) onDelete(t.id); }}>
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

function StatsTab({ stats, monthTxns }) {
  const totalExp = stats.expense || 1;
  return (
    <div className="tab-stats">
      <div className="stats-summary">
        <div className="stats-big">
          <div className="stats-label">本月支出</div>
          <div className="stats-num">NT$ {formatMoney(stats.expense)}</div>
          <div className="stats-meta">{monthTxns.filter(t => t.type === 'expense').length} 筆消費</div>
        </div>
      </div>
      <div className="section">
        <div className="section-head">
          <div className="section-title">分類統計</div>
        </div>
        {stats.catList.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">📊</div>
            <div className="empty-text">本月還沒有支出記錄</div>
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
    </div>
  );
}

function SplitTab({ members, settlement, onAddMember, onRemoveMember }) {
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
            <div className="section-title">建議結算</div>
            <Sparkles size={14} className="section-deco" />
          </div>
          {settlement.transfers.length === 0 ? (
            <div className="empty empty-mini">
              <div className="empty-emoji">✨</div>
              <div className="empty-text">大家都結清了</div>
            </div>
          ) : (
            <div className="transfer-list">
              {settlement.transfers.map((t, i) => (
                <div key={i} className="transfer-item">
                  <div className="transfer-from">{t.from}</div>
                  <div className="transfer-arrow">
                    <div className="arrow-line" />
                    <div className="arrow-amt">NT$ {formatMoney(t.amount)}</div>
                  </div>
                  <div className="transfer-to">{t.to}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
    --green: #7AA095; --red: #B85C5C;
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

  .ledger-loading {
    min-height: 100vh; display: grid; place-items: center;
    background: var(--bg); font-family: 'Noto Serif TC', serif; color: var(--ink-soft);
  }
  .loading-glow { font-size: 16px; letter-spacing: 0.1em; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .ledger-header {
    position: sticky; top: 0; z-index: 10;
    background: rgba(250, 246, 240, 0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .header-inner {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; max-width: 600px; margin: 0 auto;
  }
  .header-actions { display: flex; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark {
    width: 38px; height: 38px; border-radius: 11px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%);
    color: white; display: grid; place-items: center;
    font-family: 'Noto Serif TC', serif; font-weight: 700; font-size: 18px;
    box-shadow: var(--shadow-sm);
  }
  .brand-title { font-family: 'Noto Serif TC', serif; font-weight: 700; font-size: 16px; color: var(--ink); line-height: 1.2; }
  .brand-sub { font-size: 11px; color: var(--ink-mute); letter-spacing: 0.05em; margin-top: 2px; }
  .sync-btn {
    width: 36px; height: 36px; border-radius: 50%;
    border: 1px solid var(--line); background: var(--paper);
    color: var(--ink-soft); cursor: pointer; display: grid; place-items: center;
    transition: all 0.2s;
  }
  .sync-btn:hover { border-color: var(--accent); color: var(--accent); }
  .sync-btn.syncing svg { animation: spin 0.6s linear; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

  .ledger-main { max-width: 600px; margin: 0 auto; padding: 20px 18px; position: relative; z-index: 1; }

  .balance-card {
    position: relative; background: linear-gradient(135deg, #2B2520 0%, #3D2F22 100%);
    border-radius: var(--r-lg); padding: 28px 24px; color: #F5EFE5;
    overflow: hidden; box-shadow: var(--shadow-md); margin-bottom: 28px;
  }
  .balance-bg {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(circle at 80% 0%, rgba(232, 149, 108, 0.18) 0%, transparent 50%),
      radial-gradient(circle at 0% 100%, rgba(122, 160, 149, 0.12) 0%, transparent 50%);
    pointer-events: none;
  }
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
  .head-action { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--accent); font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 500; }

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
  .txn-mid { flex: 1; min-width: 0; }
  .txn-top { font-size: 14px; color: var(--ink); font-weight: 500; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txn-cat { font-weight: 600; }
  .txn-note { color: var(--ink-soft); font-weight: 400; }
  .txn-meta { font-size: 11px; color: var(--ink-mute); }
  .txn-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .txn-amt { font-family: 'Noto Serif TC', serif; font-weight: 600; font-size: 15px; }
  .txn-amt.expense { color: var(--ink); }
  .txn-amt.income { color: var(--green); }
  .txn-del { background: none; border: none; color: var(--ink-mute); cursor: pointer; padding: 6px; border-radius: 6px; opacity: 0; transition: all 0.2s; }
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

  .transfer-list { background: var(--paper); border-radius: var(--r-md); overflow: hidden; box-shadow: var(--shadow-sm); }
  .transfer-item { display: flex; align-items: center; padding: 16px 18px; gap: 12px; border-bottom: 1px solid var(--line-soft); }
  .transfer-item:last-child { border-bottom: none; }
  .transfer-from, .transfer-to { font-weight: 600; font-size: 14px; color: var(--ink); }
  .transfer-from { color: var(--red); }
  .transfer-to { color: var(--green); }
  .transfer-arrow { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .arrow-line { width: 100%; height: 1px; background: linear-gradient(to right, var(--red), var(--green)); position: relative; }
  .arrow-line::after { content: '→'; position: absolute; right: -2px; top: -10px; color: var(--green); font-size: 14px; }
  .arrow-amt { font-family: 'Noto Serif TC', serif; font-size: 12px; color: var(--ink-soft); font-weight: 500; }

  .fab {
    position: fixed; bottom: 86px; right: 50%; transform: translateX(50%);
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, #B5683A 100%);
    color: white; border: none; cursor: pointer; display: grid; place-items: center;
    box-shadow: 0 6px 20px rgba(201, 123, 63, 0.45), 0 2px 4px rgba(78, 60, 42, 0.2);
    z-index: 5; transition: all 0.2s;
  }
  @media (min-width: 600px) { .fab { right: calc(50% - 280px); transform: none; } }
  .fab:hover { transform: translateX(50%) scale(1.05); }
  @media (min-width: 600px) { .fab:hover { transform: scale(1.05); } }
  .fab:active { transform: translateX(50%) scale(0.95); }

  .ledger-nav {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px);
    border-top: 1px solid var(--line); display: flex; z-index: 4;
    padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  }
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
  .payer-btn:hover, .share-btn:hover { border-color: var(--ink-mute); }
  .payer-btn.active { background: var(--ink); border-color: var(--ink); color: white; }
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
`;
