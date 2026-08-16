"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Account,
  AccountType,
  ACCOUNT_TYPES,
  AccountWithBalance,
  addAccount,
  countEntriesForAccount,
  deleteAccount,
  fetchAccountsWithBalances,
  iconFor,
  updateAccount,
} from "@/lib/accounts";
import { Entry, fetchAllEntries } from "@/lib/entries";
import {
  Transfer,
  addTransfer,
  countTransfersForAccount,
  deleteTransfer,
  fetchTransfers,
  updateTransfer,
} from "@/lib/transfers";
import Calculator from "@/components/Calculator";
import AddTransactionForm from "@/components/AddTransactionForm";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountWithBalance | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);

  const [adjustTarget, setAdjustTarget] = useState<AccountWithBalance | null>(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [deleteTransferTarget, setDeleteTransferTarget] = useState<Transfer | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [newGroupPair, setNewGroupPair] = useState<[AccountWithBalance, AccountWithBalance] | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [accs, ents, trs] = await Promise.all([
        fetchAccountsWithBalances(),
        fetchAllEntries(),
        fetchTransfers(),
      ]);
      setAccounts(accs);
      setEntries(ents);
      setTransfers(trs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(acc: AccountWithBalance) {
    setEditing(acc);
    setModalOpen(true);
  }

  async function requestDelete(acc: AccountWithBalance) {
    const [entryCount, transferCount] = await Promise.all([
      countEntriesForAccount(acc.name),
      countTransfersForAccount(acc.name),
    ]);
    setDeleteUsageCount(entryCount + transferCount);
    setDeleteTarget(acc);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteAccount(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  async function handleSave(data: {
    name: string;
    type: AccountType;
    opening_balance: number;
    bank_group?: string | null;
  }) {
    if (editing) {
      await updateAccount(editing.id, data);
    } else {
      await addAccount(data);
    }
    setModalOpen(false);
    load();
  }

  function openAddTransfer() {
    setEditingTransfer(null);
    setTransferModalOpen(true);
  }

  function openEditTransfer(t: Transfer) {
    setEditingTransfer(t);
    setTransferModalOpen(true);
  }

  async function handleSaveTransfer(data: {
    from_account: string;
    to_account: string;
    amount: number;
    note: string;
    occurred_at: Date;
  }) {
    if (editingTransfer) {
      await updateTransfer(editingTransfer.id, data);
    } else {
      await addTransfer(data);
    }
    setTransferModalOpen(false);
    load();
  }

  async function confirmDeleteTransfer() {
    if (!deleteTransferTarget) return;
    await deleteTransfer(deleteTransferTarget.id);
    setDeleteTransferTarget(null);
    load();
  }

  async function moveToGroup(acc: AccountWithBalance, bankGroup: string | null) {
    await updateAccount(acc.id, {
      name: acc.name,
      type: acc.type,
      opening_balance: acc.opening_balance,
      bank_group: bankGroup,
    });
    load();
  }

  function handleDropOnAccount(targetAcc: AccountWithBalance) {
    setDragOverKey(null);
    if (!draggedId || draggedId === targetAcc.id) {
      setDraggedId(null);
      return;
    }
    const draggedAcc = accounts.find((a) => a.id === draggedId);
    setDraggedId(null);
    if (!draggedAcc) return;

    if (targetAcc.bank_group) {
      if (draggedAcc.bank_group !== targetAcc.bank_group) moveToGroup(draggedAcc, targetAcc.bank_group);
    } else if (draggedAcc.bank_group) {
      moveToGroup(targetAcc, draggedAcc.bank_group);
    } else {
      setNewGroupPair([draggedAcc, targetAcc]);
      setNewGroupName("");
    }
  }

  function handleDropOnGroup(bankName: string) {
    setDragOverKey(null);
    if (!draggedId) return;
    const draggedAcc = accounts.find((a) => a.id === draggedId);
    setDraggedId(null);
    if (draggedAcc && draggedAcc.bank_group !== bankName) moveToGroup(draggedAcc, bankName);
  }

  function handleDropToUngroup() {
    setDragOverKey(null);
    if (!draggedId) return;
    const draggedAcc = accounts.find((a) => a.id === draggedId);
    setDraggedId(null);
    if (draggedAcc && draggedAcc.bank_group) moveToGroup(draggedAcc, null);
  }

  async function confirmNewGroup() {
    if (!newGroupPair || !newGroupName.trim()) return;
    const name = newGroupName.trim();
    setGroupSaving(true);
    try {
      await Promise.all(newGroupPair.map((acc) => moveToGroup(acc, name)));
      setNewGroupPair(null);
      setNewGroupName("");
    } finally {
      setGroupSaving(false);
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const ungrouped = accounts.filter((a) => !a.bank_group);
  const groups = new Map<string, AccountWithBalance[]>();
  for (const acc of accounts) {
    if (!acc.bank_group) continue;
    if (!groups.has(acc.bank_group)) groups.set(acc.bank_group, []);
    groups.get(acc.bank_group)!.push(acc);
  }

  function renderAccountCard(acc: AccountWithBalance) {
    const recentTx = entries.filter((e) => e.account === acc.name).slice(0, 3);
    const isDragging = draggedId === acc.id;
    const isDragOver = dragOverKey === `acc:${acc.id}`;
    return (
      <div
        key={acc.id}
        draggable
        onDragStart={() => setDraggedId(acc.id)}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverKey(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggedId && draggedId !== acc.id) setDragOverKey(`acc:${acc.id}`);
        }}
        onDragLeave={() => setDragOverKey((k) => (k === `acc:${acc.id}` ? null : k))}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDropOnAccount(acc);
        }}
        className={`bg-neutral-900 border rounded-2xl p-4 flex flex-col gap-3 cursor-grab active:cursor-grabbing transition ${
          isDragOver ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-neutral-800"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center text-base">
              {iconFor(acc.type, acc.name)}
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-100">{acc.name}</p>
              <p className="text-xs text-neutral-500">{acc.type}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setAdjustTarget(acc)}
              aria-label="加减一笔"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-indigo-400 text-sm font-semibold"
            >
              ±
            </button>
            <button
              onClick={() => openEdit(acc)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 text-xs"
            >
              ✏️
            </button>
            <button
              onClick={() => requestDelete(acc)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 text-xs"
            >
              🗑️
            </button>
          </div>
        </div>

        <p
          className={`text-2xl font-semibold ${
            acc.balance >= 0 ? "text-neutral-100" : "text-rose-400"
          }`}
        >
          RM {acc.balance.toLocaleString("en-MY")}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-emerald-400">收入 RM {acc.income.toLocaleString("en-MY")}</span>
          <span className="text-rose-400">支出 RM {acc.expense.toLocaleString("en-MY")}</span>
          {(acc.transferIn > 0 || acc.transferOut > 0) && (
            <span className="text-indigo-400">
              转入 RM {acc.transferIn.toLocaleString("en-MY")} · 转出 RM{" "}
              {acc.transferOut.toLocaleString("en-MY")}
            </span>
          )}
        </div>

        <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1.5">
          {recentTx.length === 0 ? (
            <p className="text-xs text-neutral-600">还没有交易</p>
          ) : (
            recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">{tx.category}</span>
                <span className={tx.type === "收入" ? "text-emerald-400" : "text-rose-400"}>
                  {tx.type === "收入" ? "+" : "-"}
                  {tx.amount.toLocaleString("en-MY")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">账户</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            管理你的银行、现金和其他账户 · 总资产 RM {totalBalance.toLocaleString("en-MY")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAddTransfer}
            disabled={accounts.length < 2}
            className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition text-neutral-200 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
          >
            ↔ 转账
          </button>
          <button
            onClick={openAdd}
            className="bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            + 新增账户
          </button>
        </div>
      </header>

      {!loading && accounts.length > 0 && (
        <p className="text-xs text-neutral-600">
          💡 提示：用鼠标把一张账户卡片拖到另一张卡片、或拖进银行框里，就可以把它们收在一起
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-600 text-center py-16">读取中...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-16">还没有账户，先新增一个吧</p>
      ) : (
        <>
          {ungrouped.length > 0 && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedId) setDragOverKey("ungrouped");
              }}
              onDragLeave={() => setDragOverKey((k) => (k === "ungrouped" ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                handleDropToUngroup();
              }}
              className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-2xl transition ${
                dragOverKey === "ungrouped" ? "ring-2 ring-neutral-600 ring-offset-2 ring-offset-neutral-950" : ""
              }`}
            >
              {ungrouped.map((acc) => renderAccountCard(acc))}
            </div>
          )}

          {Array.from(groups.entries()).map(([bankName, accs]) => {
            const groupTotal = accs.reduce((s, a) => s + a.balance, 0);
            const isGroupDragOver = dragOverKey === `group:${bankName}`;
            return (
              <div
                key={bankName}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedId) setDragOverKey(`group:${bankName}`);
                }}
                onDragLeave={() => setDragOverKey((k) => (k === `group:${bankName}` ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnGroup(bankName);
                }}
                className={`border rounded-2xl p-4 flex flex-col gap-4 bg-neutral-950/40 transition ${
                  isGroupDragOver ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-200">🏦 {bankName}</p>
                  <p className="text-sm text-neutral-400">
                    合计 RM {groupTotal.toLocaleString("en-MY")}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accs.map((acc) => renderAccountCard(acc))}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <p className="text-sm font-medium text-neutral-300 mb-3">转账记录</p>
        {transfers.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-6">还没有转账记录</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-800">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-100">
                    {t.from_account} <span className="text-neutral-600">→</span> {t.to_account}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {new Date(t.occurred_at).toLocaleDateString("zh-CN")}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-medium text-neutral-200 mr-1">
                    RM {t.amount.toLocaleString("en-MY")}
                  </span>
                  <button
                    onClick={() => openEditTransfer(t)}
                    aria-label="编辑"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 text-xs"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteTransferTarget(t)}
                    aria-label="删除"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 text-xs"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <p className="text-sm font-medium text-neutral-300 mb-3">计算机</p>
        <Calculator />
      </div>

      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title={adjustTarget ? `「${adjustTarget.name}」加减一笔` : "加减一笔"}
      >
        {adjustTarget && (
          <AddTransactionForm
            presetAccount={adjustTarget.name}
            onSaved={() => {
              setAdjustTarget(null);
              load();
            }}
          />
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑账户" : "新增账户"}>
        <AccountForm initial={editing} onCancel={() => setModalOpen(false)} onSave={handleSave} />
      </Modal>

      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title={editingTransfer ? "编辑转账" : "账户之间转账"}
      >
        <TransferForm
          initial={editingTransfer}
          accountNames={accounts.map((a) => a.name)}
          onCancel={() => setTransferModalOpen(false)}
          onSave={handleSaveTransfer}
        />
      </Modal>

      <Modal
        open={!!newGroupPair}
        onClose={() => {
          setNewGroupPair(null);
          setNewGroupName("");
        }}
        title="帮这个银行取个名字"
      >
        {newGroupPair && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-400">
              把「{newGroupPair[0].name}」和「{newGroupPair[1].name}」收在一起，取个银行名字
            </p>
            <div>
              <label className="text-xs text-neutral-500">银行名字</label>
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="例如：RYT Bank"
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-700"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNewGroupPair(null);
                  setNewGroupName("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-800 text-neutral-300 text-sm"
              >
                取消
              </button>
              <button
                onClick={confirmNewGroup}
                disabled={!newGroupName.trim() || groupSaving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium disabled:bg-neutral-800 disabled:text-neutral-600"
              >
                {groupSaving ? "保存中..." : "确定"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这个账户？"
        message={
          deleteUsageCount > 0
            ? `「${deleteTarget?.name}」还有 ${deleteUsageCount} 笔记录（交易或转账），删除账户不会删除这些记录，但它们会变成没有账户。确定要删除吗？`
            : `确定要删除「${deleteTarget?.name}」吗？`
        }
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTransferTarget}
        title="删除这笔转账？"
        message={
          deleteTransferTarget
            ? `${deleteTransferTarget.from_account} → ${deleteTransferTarget.to_account} · RM ${deleteTransferTarget.amount.toFixed(
                2
              )}，删除后无法恢复`
            : ""
        }
        confirmLabel="删除"
        onConfirm={confirmDeleteTransfer}
        onCancel={() => setDeleteTransferTarget(null)}
      />
    </div>
  );
}

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Account | null;
  onSave: (data: {
    name: string;
    type: AccountType;
    opening_balance: number;
    bank_group?: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>(initial?.type ?? "银行");
  const [openingBalance, setOpeningBalance] = useState(String(initial?.opening_balance ?? "0"));
  const [bankGroup, setBankGroup] = useState(initial?.bank_group ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      setError("请输入账户名称");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        opening_balance: parseFloat(openingBalance) || 0,
        bank_group: bankGroup.trim() || null,
      });
    } catch {
      setError("保存失败，账户名称可能已经存在");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-neutral-500">账户名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：Public Bank"
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-700"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-500">类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-500">期初余额 (RM)</label>
        <input
          type="number"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
        />
        <p className="text-xs text-neutral-600 mt-1">
          之后的余额会自动照这个账户的收支记录（和转账）去加减
        </p>
      </div>
      <div>
        <label className="text-xs text-neutral-500">所属银行（选填，例如 RYT Bank）</label>
        <input
          value={bankGroup}
          onChange={(e) => setBankGroup(e.target.value)}
          placeholder="不填的话，这个账户会照旧独立显示"
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-700"
        />
        <p className="text-xs text-neutral-600 mt-1">
          填了之后，这个账户会跟同一间银行底下的其他账户收在一起显示
        </p>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex gap-3 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-neutral-800 text-neutral-300 text-sm"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={!name || saving}
          className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

function TransferForm({
  initial,
  accountNames,
  onSave,
  onCancel,
}: {
  initial: Transfer | null;
  accountNames: string[];
  onSave: (data: {
    from_account: string;
    to_account: string;
    amount: number;
    note: string;
    occurred_at: Date;
  }) => void;
  onCancel: () => void;
}) {
  const [fromAccount, setFromAccount] = useState(initial?.from_account ?? accountNames[0] ?? "");
  const [toAccount, setToAccount] = useState(
    initial?.to_account ?? accountNames.find((a) => a !== accountNames[0]) ?? ""
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(() =>
    initial ? initial.occurred_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("金额要大于 0");
      return;
    }
    if (!fromAccount || !toAccount) {
      setError("请选择转出和转入的账户");
      return;
    }
    if (fromAccount === toAccount) {
      setError("转出和转入不能是同一个账户");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        from_account: fromAccount,
        to_account: toAccount,
        amount: value,
        note,
        occurred_at: new Date(date + "T12:00:00"),
      });
    } catch {
      setError("保存失败，请再试一次");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-neutral-500">金额 (RM)</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full text-2xl font-semibold outline-none mt-1 bg-transparent placeholder:text-neutral-700 text-neutral-100"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500">从</label>
          <select
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
          >
            {accountNames.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">到</label>
          <select
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
          >
            {accountNames.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-neutral-500">日期</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-500">备注（选填）</label>
        <input
          type="text"
          placeholder="例如：投资钱包转去 IBKR"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-neutral-700 text-neutral-100"
        />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        onClick={submit}
        disabled={!amount || saving}
        className="w-full py-3 rounded-xl bg-indigo-500 text-white font-medium disabled:bg-neutral-800 disabled:text-neutral-600 transition"
      >
        {saving ? "保存中..." : "保存转账"}
      </button>
    </div>
  );
}
