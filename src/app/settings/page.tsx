"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntryType } from "@/lib/entries";
import {
  addCategory as addCategoryDb,
  Category,
  countEntriesForCategory,
  deleteCategory as deleteCategoryDb,
  fetchCategories,
} from "@/lib/categories";
import ConfirmDialog from "@/components/ConfirmDialog";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-neutral-100">{title}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Eeson记账本");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("MYR");
  const [autoSplitMonth, setAutoSplitMonth] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCat, setNewCat] = useState("");
  const [newCatType, setNewCatType] = useState<EntryType>("支出");
  const [catError, setCatError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      setCategories(await fetchCategories());
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function addCategory() {
    setCatError("");
    const name = newCat.trim();
    if (!name) return;
    if (categories.some((c) => c.type === newCatType && c.name === name)) {
      setCatError("这个分类已经存在了");
      return;
    }
    try {
      await addCategoryDb({ name, type: newCatType });
      setNewCat("");
      loadCategories();
    } catch {
      setCatError("新增失败，请再试一次");
    }
  }

  async function requestRemoveCategory(cat: Category) {
    const count = await countEntriesForCategory(cat.name);
    setDeleteUsageCount(count);
    setDeleteTarget(cat);
  }

  async function confirmRemoveCategory() {
    if (!deleteTarget) return;
    await deleteCategoryDb(deleteTarget.id);
    setDeleteTarget(null);
    loadCategories();
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">设置</h1>
        <p className="text-sm text-neutral-500 mt-0.5">调整你的基本资料和使用偏好</p>
      </header>

      <Section title="个人资料">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500">生意名称</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">邮箱</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </div>
      </Section>

      <Section title="货币" description="记账和报表都会用这个货币显示">
        <div className="flex gap-2">
          {["MYR", "SGD", "USD"].map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-lg text-sm border ${
                currency === c
                  ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                  : "border-neutral-800 text-neutral-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section title="分类" description="记一笔的时候可以选的收入/支出分类">
        {loadingCategories ? (
          <p className="text-sm text-neutral-600 text-center py-4">读取中...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(["收入", "支出"] as EntryType[]).map((type) => (
              <div key={type}>
                <p className="text-xs text-neutral-500 mb-1.5">{type}</p>
                <div className="flex flex-wrap gap-2">
                  {categories.filter((c) => c.type === type).length === 0 && (
                    <span className="text-xs text-neutral-600">还没有分类</span>
                  )}
                  {categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-950 border border-neutral-800 text-neutral-300"
                      >
                        {c.name}
                        <button
                          onClick={() => requestRemoveCategory(c)}
                          className="text-neutral-600 hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1 border-t border-neutral-800">
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as EntryType)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100 mt-3"
          >
            <option value="收入">收入</option>
            <option value="支出">支出</option>
          </select>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="新增分类名称"
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 mt-3 placeholder:text-neutral-700"
          />
          <button
            onClick={addCategory}
            className="mt-3 px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 text-sm"
          >
            新增
          </button>
        </div>
        {catError && <p className="text-sm text-rose-400">{catError}</p>}
      </Section>

      <Section title="账户" description="管理银行、现金、信用卡等账户">
        <Link
          href="/accounts"
          className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 hover:text-neutral-100"
        >
          前往账户管理 →
        </Link>
      </Section>

      <Section title="外观">
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg text-sm border border-indigo-500 bg-indigo-500/10 text-indigo-400">
            深色（目前）
          </button>
          <button
            disabled
            className="px-4 py-2 rounded-lg text-sm border border-neutral-800 text-neutral-600 cursor-not-allowed"
          >
            浅色（即将推出）
          </button>
        </div>
      </Section>

      <Section title="账号安全" description="这个账本设了密码，只有知道密码的人能进来">
        <button
          onClick={handleLogout}
          className="w-fit px-4 py-2 rounded-lg text-sm border border-neutral-800 text-neutral-300 hover:text-rose-400 hover:border-rose-500/50"
        >
          登出
        </button>
      </Section>

      <Section title="数据" description="关于你的记账数据存放方式">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-200">自动按月份分开记录</p>
            <p className="text-xs text-neutral-500 mt-0.5">月报表会自动依日期分月，不用手动结算</p>
          </div>
          <button
            onClick={() => setAutoSplitMonth((v) => !v)}
            className={`w-11 h-6 rounded-full transition relative shrink-0 ${
              autoSplitMonth ? "bg-indigo-500" : "bg-neutral-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                autoSplitMonth ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <button
          disabled
          className="w-fit px-4 py-2 rounded-lg text-sm border border-neutral-800 text-neutral-600 cursor-not-allowed"
        >
          导出数据（即将推出）
        </button>
      </Section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这个分类？"
        message={
          deleteUsageCount > 0
            ? `已经有 ${deleteUsageCount} 笔记录用了「${deleteTarget?.name}」这个分类，删除后这些记录还在，只是分类名字会保留旧的。确定要删除吗？`
            : `确定要删除「${deleteTarget?.name}」吗？`
        }
        confirmLabel="删除"
        onConfirm={confirmRemoveCategory}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
