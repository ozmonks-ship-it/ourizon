import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ASSET_GROUPS, HISTORICAL } from "../data/assets";
import { fmt, fmtK } from "../lib/format";
import { Sparkline } from "../components/Sparkline";

interface CustomAccount {
  name: string;
  institution: string;
  balance: number;
  groupId: string;
  spark: number[];
}

export function AssetsScreen() {
  const initBal: Record<string, number> = {};
  ASSET_GROUPS.forEach((g) => g.accounts.forEach((a) => { initBal[a.name] = a.balance; }));

  const [balances, setBalances] = useState(initBal);
  const [customAccounts, setCustomAccounts] = useState<CustomAccount[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [updated, setUpdated] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: "",
    institution: "",
    balance: "",
    groupId: "cash",
  });

  const totalNW =
    Object.values(balances).reduce((a, b) => a + b, 0) +
    customAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  const confirm = (name: string) => {
    const v = parseFloat(editVal);
    if (!isNaN(v) && v >= 0) {
      setBalances((p) => ({ ...p, [name]: v }));
      setUpdated(name);
      setTimeout(() => setUpdated(null), 2500);
    }
    setEditing(null);
  };

  const addAsset = () => {
    const balance = parseFloat(newAsset.balance);
    if (!newAsset.name.trim() || isNaN(balance) || balance < 0) return;

    const account: CustomAccount = {
      name: newAsset.name.trim(),
      institution: newAsset.institution.trim() || "Self-managed",
      balance,
      groupId: newAsset.groupId,
      spark: [balance * 0.85, balance * 0.9, balance * 0.92, balance * 0.95, balance * 0.98, balance],
    };

    setCustomAccounts((prev) => [...prev, account]);
    setBalances((prev) => ({ ...prev, [account.name]: balance }));
    setNewAsset({ name: "", institution: "", balance: "", groupId: "cash" });
    setDialogOpen(false);
    setUpdated(account.name);
    setTimeout(() => setUpdated(null), 2500);
  };

  const deleteAsset = (name: string) => {
    setCustomAccounts((prev) => prev.filter((a) => a.name !== name));
    setBalances((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const allGroups = ASSET_GROUPS.map((g) => ({
    ...g,
    accounts: [...g.accounts, ...customAccounts.filter((ca) => ca.groupId === g.id)],
  })).filter((g) => g.accounts.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground mb-1">Your Assets 💼</h1>
          <p className="text-muted-foreground text-sm">
            Total: <span className="font-medium text-foreground">{fmt(totalNW)}</span>
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95"
            >
              <PlusCircle size={16} />
              Add
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-medium">Add New Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Name</label>
                <Input
                  placeholder="Investment Property - Sydney"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Institution / Provider
                </label>
                <Input
                  placeholder="Ray White, Self-managed"
                  value={newAsset.institution}
                  onChange={(e) => setNewAsset({ ...newAsset, institution: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current Value ($)</label>
                <Input
                  type="number"
                  placeholder="250000"
                  value={newAsset.balance}
                  onChange={(e) => setNewAsset({ ...newAsset, balance: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") addAsset(); }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Type</label>
                <Select value={newAsset.groupId} onValueChange={(val) => setNewAsset({ ...newAsset, groupId: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_GROUPS.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={addAsset}
                className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-95 mt-2"
              >
                Add Asset
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border">
        <h2 className="font-medium text-base text-foreground mb-0.5">Net Worth 📈</h2>
        <p className="text-xs text-muted-foreground mb-4">Monthly growth over time</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={HISTORICAL} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              formatter={(v: number) => [fmt(v), "Net worth"]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="currentColor"
              strokeWidth={2}
              fill="currentColor"
              fillOpacity={0.1}
              dot={false}
              strokeOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {allGroups.map((group) => {
          const groupTotal = group.accounts.reduce((s, a) => s + balances[a.name], 0);
          return (
            <div key={group.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <p className="font-medium text-sm flex-1 text-foreground">{group.label}</p>
                <p className="font-medium text-foreground text-base">{fmtK(groupTotal)}</p>
              </div>
              <div className="divide-y divide-border">
                {group.accounts.map((account) => {
                  const isEditing = editing === account.name;
                  const wasUpdated = updated === account.name;
                  const isCustom = customAccounts.some((ca) => ca.name === account.name);
                  return (
                    <div key={account.name} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{account.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.institution}</p>
                      </div>
                      <div className="w-16 shrink-0">
                        <Sparkline data={account.spark} id={`${group.id}-${account.name}`} />
                      </div>
                      <div className="shrink-0 text-right">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="number"
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirm(account.name);
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className="w-24 bg-muted rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground text-right focus:outline-none focus:ring-2 focus:ring-foreground/20"
                            />
                            <button
                              type="button"
                              onClick={() => confirm(account.name)}
                              className="w-6 h-6 rounded-md flex items-center justify-center bg-foreground text-background"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{fmt(balances[account.name])}</p>
                              {wasUpdated && <p className="text-xs text-muted-foreground text-right">✓</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(account.name);
                                setEditVal(String(balances[account.name]));
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => deleteAsset(account.name)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Delete asset"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
