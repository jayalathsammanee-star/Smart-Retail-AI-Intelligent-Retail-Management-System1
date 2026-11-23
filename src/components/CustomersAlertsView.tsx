import React, { useEffect, useState } from 'react';
import { Bell, Check, Plus, Shield, UserCheck, Users, X } from 'lucide-react';
import { apiRequest, formatCurrency, formatShortDate } from '../lib/api';
import type { CustomerRecord, NotificationRecord, PublicUser } from '../types';

interface CustomersAlertsViewProps {
  currentUser: PublicUser;
  branches: string[];
  onProfileUpdated: (user: PublicUser) => void;
  onNotificationsChanged: () => void;
}

export const CustomersAlertsView: React.FC<CustomersAlertsViewProps> = ({
  currentUser,
  branches,
  onProfileUpdated,
  onNotificationsChanged,
}) => {
  const [tab, setTab] = useState<'notifications' | 'customers' | 'team'>('notifications');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [teamUsers, setTeamUsers] = useState<PublicUser[]>([]);
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custBranch, setCustBranch] = useState(branches[0] || 'Flagship Downtown');
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileBranch, setProfileBranch] = useState(currentUser.branch);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [notifRes, custRes] = await Promise.all([
        apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications'),
        apiRequest<{ customers: CustomerRecord[] }>('/api/customers'),
      ]);
      setNotifications(notifRes.notifications);
      setCustomers(custRes.customers);
      if (currentUser.role === 'admin') {
        const usersRes = await apiRequest<{ users: PublicUser[] }>('/api/users');
        setTeamUsers(usersRes.users);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.role]);

  const handleMarkRead = async (id: number) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await loadData();
    onNotificationsChanged();
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
    await loadData();
    onNotificationsChanged();
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: custName,
          email: custEmail,
          phone: custPhone,
          branch: custBranch,
        }),
      });
      setAddCustOpen(false);
      setCustName('');
      setCustEmail('');
      setCustPhone('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ user: PublicUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: profileName, branch: profileBranch }),
      });
      onProfileUpdated(res.user);
      setNotice('Profile preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed');
    }
  };

  const handleRoleChange = async (userId: number, role: 'admin' | 'staff') => {
    setError(null);
    try {
      await apiRequest(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E113A] dark:text-[#F5F3FF]">
            Customers, Alerts & Access Control
          </h1>
          <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
            Monitor automated stockout notifications, CRM spend profiles, and staff roles
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAFF] dark:bg-[#1D1433] w-fit">
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'notifications' ? 'bg-[#6D28D9] text-white' : 'text-[#5B4B7A] dark:text-[#A799C9]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </button>
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'customers' ? 'bg-[#6D28D9] text-white' : 'text-[#5B4B7A] dark:text-[#A799C9]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Customers
          </button>
          <button
            type="button"
            onClick={() => setTab('team')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'team' ? 'bg-[#6D28D9] text-white' : 'text-[#5B4B7A] dark:text-[#A799C9]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Profile & RBAC
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {tab === 'notifications' && (
        <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Automated Retail & Inventory Alerts</h2>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-[#6D28D9] dark:text-[#A78BFA] hover:underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`py-4 flex items-start justify-between gap-4 ${
                  n.isRead ? 'opacity-65' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold uppercase tracking-wide ${
                        n.severity === 'critical'
                          ? 'text-red-600 dark:text-red-400'
                          : n.severity === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#6D28D9] dark:text-[#A78BFA]'
                      }`}
                    >
                      {n.severity}
                    </span>
                    <span className="text-[#5B4B7A] dark:text-[#A799C9]">·</span>
                    <span className="text-[#5B4B7A] dark:text-[#A799C9]">
                      {formatShortDate(n.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                  <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">{n.message}</p>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] hover:bg-[#EFEAFF] dark:hover:bg-[#22173D] flex items-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'customers' && (
        <section className="p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Customer Directory ({customers.length})</h2>
            <button
              type="button"
              onClick={() => setAddCustOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E2FA] dark:border-[#2A1F47] text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">Branch</th>
                  <th className="py-2 font-medium text-right">Orders</th>
                  <th className="py-2 font-medium text-right">Total Spend</th>
                  <th className="py-2 font-medium text-right">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        {c.email || c.phone}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{c.branch}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{c.orderCount}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="py-2.5 text-right text-xs font-mono text-[#5B4B7A] dark:text-[#A799C9]">
                      {c.lastPurchaseAt ? formatShortDate(c.lastPurchaseAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'team' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-5 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <div className="flex items-center gap-3 mb-5">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border border-[#E9E2FA] dark:border-[#2A1F47]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#EFEAFF] dark:bg-[#24193E] flex items-center justify-center text-[#6D28D9]">
                  <UserCheck className="w-5 h-5" />
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold">{currentUser.name}</h2>
                <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                  {currentUser.email} · Role: {currentUser.role.toUpperCase()}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">
                  Default Branch
                </label>
                <select
                  value={profileBranch}
                  onChange={(e) => setProfileBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white"
              >
                Save Profile
              </button>
            </form>
          </section>

          <section className="xl:col-span-7 p-6 rounded-xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47]">
            <h2 className="text-base font-semibold mb-1">Role-Based Access Control (RBAC)</h2>
            <p className="text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-4">
              Administrators can promote or restrict staff accounts across branches
            </p>
            {currentUser.role !== 'admin' ? (
              <p className="text-sm text-[#5B4B7A] dark:text-[#A799C9]">
                You are signed in with Staff permissions. Contact an Administrator to manage team roles.
              </p>
            ) : (
              <div className="divide-y divide-[#EFEAFF] dark:divide-[#2A1F47]">
                {teamUsers.map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-[#5B4B7A] dark:text-[#A799C9]">
                        {u.email} · {u.branch}
                      </div>
                    </div>
                    <select
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'staff')}
                      className="px-2.5 py-1.5 text-xs rounded-md border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819] disabled:opacity-60"
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {addCustOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#160F29] border border-[#E9E2FA] dark:border-[#2A1F47] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Add Customer</h2>
              <button
                type="button"
                onClick={() => setAddCustOpen(false)}
                className="p-1 rounded-md hover:bg-[#EFEAFF] dark:hover:bg-[#24193E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Email</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Phone</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B4B7A] dark:text-[#A799C9] mb-1">Home Branch</label>
                <select
                  value={custBranch}
                  onChange={(e) => setCustBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47] bg-[#F7F5FF] dark:bg-[#0D0819]"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddCustOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E9E2FA] dark:border-[#2A1F47]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
