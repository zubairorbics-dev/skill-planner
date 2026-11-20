import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LogOut,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  AccountStatus,
  AiLogEntry,
  isProfileActive,
  Roadmap,
  UserProfile,
} from '../types/planner';
import {
  fetchAllAiLogsAdmin,
  fetchAllProfilesAdmin,
  fetchAllRoadmapsAdmin,
  setUserAccountStatusAdmin,
} from '../lib/firestoreService';

interface AdminConsoleProps {
  adminEmail: string;
  onExitAdmin: () => void;
  onAdminLogout: () => Promise<void>;
}

type AdminPage = 'users' | 'logs' | 'user-detail';
type SortField = 'fullName' | 'experienceLevel' | 'roadmapCount' | 'createdAt';
type LogFilter = 'all' | 'success' | 'error';

const PAGE_SIZE = 8;

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  adminEmail,
  onExitAdmin,
  onAdminLogout,
}) => {
  const [page, setPage] = useState<AdminPage>('users');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedLog, setSelectedLog] = useState<AiLogEntry | null>(null);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Users table controls
  const [userSearch, setUserSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [userPageNum, setUserPageNum] = useState(1);

  // Logs table controls
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logPageNum, setLogPageNum] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allProfiles, allRoadmaps, allLogs] = await Promise.all([
        fetchAllProfilesAdmin(),
        fetchAllRoadmapsAdmin(),
        fetchAllAiLogsAdmin(),
      ]);
      setProfiles(allProfiles);
      setRoadmaps(allRoadmaps);
      setLogs(allLogs);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Unable to load administrative records.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleAccountStatus = async () => {
    if (!selectedUser || statusUpdating) return;
    const nextStatus: AccountStatus = isProfileActive(selectedUser)
      ? 'inactive'
      : 'active';
    const actionLabel = nextStatus === 'inactive' ? 'deactivate' : 'reactivate';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} ${selectedUser.fullName} (${selectedUser.email})?` +
        (nextStatus === 'inactive'
          ? '\n\nThey will not be able to use the learner app until reactivated.'
          : '')
    );
    if (!confirmed) return;

    setStatusUpdating(true);
    setError(null);
    try {
      await setUserAccountStatusAdmin(selectedUser.uid, nextStatus);
      const updated: UserProfile = {
        ...selectedUser,
        accountStatus: nextStatus,
      };
      setSelectedUser(updated);
      setProfiles((prev) =>
        prev.map((p) => (p.uid === selectedUser.uid ? updated : p))
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : `Unable to ${actionLabel} this user right now.`
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const roadmapCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const rm of roadmaps) {
      map.set(rm.userId, (map.get(rm.userId) ?? 0) + 1);
    }
    return map;
  }, [roadmaps]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = profiles.filter((p) => {
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.targetRole.toLowerCase().includes(q) ||
        p.careerGoal.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'fullName') {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'experienceLevel') {
        cmp = a.experienceLevel.localeCompare(b.experienceLevel);
      } else if (sortField === 'roadmapCount') {
        const ca = roadmapCountByUser.get(a.uid) ?? a.roadmapCount ?? 0;
        const cb = roadmapCountByUser.get(b.uid) ?? b.roadmapCount ?? 0;
        cmp = ca - cb;
      } else {
        cmp = (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [profiles, userSearch, sortField, sortAsc, roadmapCountByUser]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (userPageNum - 1) * PAGE_SIZE,
    userPageNum * PAGE_SIZE
  );

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((l) => {
      if (logFilter !== 'all' && l.status !== logFilter) return false;
      if (!q) return true;
      return (
        l.userName.toLowerCase().includes(q) ||
        l.userEmail.toLowerCase().includes(q) ||
        l.promptSummary.toLowerCase().includes(q)
      );
    });
  }, [logs, logFilter, logSearch]);

  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice(
    (logPageNum - 1) * PAGE_SIZE,
    logPageNum * PAGE_SIZE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setUserPageNum(1);
  };

  const activeRoadmapsCount = useMemo(
    () => roadmaps.filter((r) => r.status === 'active').length,
    [roadmaps]
  );

  const successLogsCount = useMemo(
    () => logs.filter((l) => l.status === 'success').length,
    [logs]
  );

  const adminInitial = (adminEmail.trim()[0] || 'A').toUpperCase();

  const selectedUserRoadmaps = selectedUser
    ? roadmaps.filter((r) => r.userId === selectedUser.uid)
    : [];
  const selectedUserLogs = selectedUser
    ? logs.filter((l) => l.userId === selectedUser.uid)
    : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <aside className="w-full lg:w-60 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-4 flex items-center justify-between lg:justify-start gap-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center">
              S
            </div>
            <span className="font-bold text-sm text-slate-900 whitespace-nowrap">
              Admin Console
            </span>
          </div>

          <div className="flex lg:hidden items-center gap-3">
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap cursor-pointer"
            >
              Learner App
            </button>
            <button
              type="button"
              onClick={() => void onAdminLogout()}
              className="text-xs font-semibold text-slate-600 hover:text-red-700 whitespace-nowrap cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setPage('users');
              setSelectedUser(null);
            }}
            className={`min-h-[42px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              page === 'users' || page === 'user-detail'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Users</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPage('logs');
              setSelectedUser(null);
            }}
            className={`min-h-[42px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap cursor-pointer ${
              page === 'logs'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0" />
            <span>AI Logs</span>
          </button>
        </nav>

        <div className="hidden lg:flex flex-col gap-1 p-3 mt-auto border-t border-slate-100">
          <button
            type="button"
            onClick={onExitAdmin}
            className="min-h-[40px] px-3.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Learner App</span>
          </button>
          <button
            type="button"
            onClick={() => void onAdminLogout()}
            className="min-h-[40px] px-3.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 min-w-0">
            {page === 'user-detail' && selectedUser ? (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setPage('users');
                    setSelectedUser(null);
                  }}
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  Users
                </button>
                <span className="text-slate-400">/</span>
                <span className="truncate">{selectedUser.fullName}</span>
              </div>
            ) : (
              <span>{page === 'users' ? 'Users' : 'AI Generation Logs'}</span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                {adminInitial}
              </div>
              <span className="text-xs font-semibold text-slate-700 max-w-[200px] truncate">
                {adminEmail}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <>
              {/* USERS LIST */}
              {page === 'users' && (
                <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Users</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  View-only directory of registered learners and their generated roadmaps.
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <p className="text-xs font-medium text-slate-500">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
                    {profiles.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <p className="text-xs font-medium text-slate-500">Active Roadmaps</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1.5 tabular-nums">
                    {activeRoadmapsCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <p className="text-xs font-medium text-slate-500">
                    Successful AI Generations
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1.5 tabular-nums">
                    {successLogsCount}
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-4 relative max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPageNum(1);
                  }}
                  placeholder="Search by name, email, or goal..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Users DataTable */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleSort('fullName')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                          >
                            <span>Name</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleSort('experienceLevel')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                          >
                            <span>Experience</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3">Goal</th>
                        <th className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSort('roadmapCount')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                          >
                            <span>Roadmaps</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSort('createdAt')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                          >
                            <span>Joined</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={7} className="px-4 py-4">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          </tr>
                        ))
                      ) : paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                            No users match your current filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => {
                          const count = roadmapCountByUser.get(u.uid) ?? u.roadmapCount ?? 0;
                          const active = isProfileActive(u);
                          return (
                            <tr
                              key={u.uid}
                              onClick={() => {
                                setSelectedUser(u);
                                setPage('user-detail');
                              }}
                              className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                {u.fullName}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                                {u.email}
                              </td>
                              <td className="px-4 py-3.5 capitalize text-slate-700">
                                {u.experienceLevel}
                              </td>
                              <td className="px-4 py-3.5 text-slate-700 max-w-xs truncate">
                                {u.targetRole || u.careerGoal || 'Onboarding pending'}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">
                                {count}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    active
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                                {formatDate(u.createdAt)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="tabular-nums">
                    Showing {filteredUsers.length === 0 ? 0 : (userPageNum - 1) * PAGE_SIZE + 1}
                    –{Math.min(userPageNum * PAGE_SIZE, filteredUsers.length)} of{' '}
                    {filteredUsers.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={userPageNum <= 1}
                      onClick={() => setUserPageNum((p) => Math.max(1, p - 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-semibold text-slate-700 tabular-nums">
                      {userPageNum} / {userTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={userPageNum >= userTotalPages}
                      onClick={() => setUserPageNum((p) => Math.min(userTotalPages, p + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USER DETAIL DRILL-DOWN */}
          {page === 'user-detail' && selectedUser && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xl flex items-center justify-center shrink-0">
                  {selectedUser.fullName
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-slate-900">
                      {selectedUser.fullName}
                    </h1>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isProfileActive(selectedUser)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {isProfileActive(selectedUser) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">{selectedUser.email}</p>
                  <p className="text-xs text-slate-500 mt-1.5 capitalize tabular-nums">
                    {selectedUser.experienceLevel} ·{' '}
                    {selectedUser.onboardingCompleted ? 'Onboarded' : 'Pending onboarding'} ·
                    Joined {formatDate(selectedUser.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => void handleToggleAccountStatus()}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                    isProfileActive(selectedUser)
                      ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {statusUpdating
                    ? 'Updating...'
                    : isProfileActive(selectedUser)
                      ? 'Deactivate User'
                      : 'Activate User'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <h2 className="text-sm font-bold text-slate-900 pb-3 mb-3 border-b border-slate-100">
                    Profile Information
                  </h2>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Education</span>
                      <span className="font-medium text-slate-900 text-right">
                        {selectedUser.education || '—'}
                        {selectedUser.fieldOfStudy ? ` — ${selectedUser.fieldOfStudy}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Profession</span>
                      <span className="font-medium text-slate-900 text-right">
                        {selectedUser.profession || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Available Time</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {selectedUser.availableHoursPerDay}h / day
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Preferred Days</span>
                      <span className="font-medium text-slate-900 text-right">
                        {selectedUser.preferredDays.join(', ')}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <h2 className="text-sm font-bold text-slate-900 pb-3 mb-3 border-b border-slate-100">
                    Career Goal & Skills
                  </h2>
                  <p className="text-xs font-semibold text-indigo-600 mb-1">
                    {selectedUser.targetRole || 'No target role set'}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    {selectedUser.careerGoal || 'No career goal submitted yet.'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Current Skills</p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedUser.currentSkills.length > 0
                      ? selectedUser.currentSkills.join(' · ')
                      : 'None listed'}
                  </p>
                </section>
              </div>

              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 mb-4">Roadmap History</h2>
                {selectedUserRoadmaps.length === 0 ? (
                  <p className="text-sm text-slate-500">No roadmaps generated yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 pr-4">Target Role</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Phases</th>
                          <th className="py-2.5 px-4">Progress</th>
                          <th className="py-2.5 pl-4 text-right">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedUserRoadmaps.map((rm) => {
                          const pct =
                            rm.totalTasks > 0
                              ? Math.round((rm.completedTasks / rm.totalTasks) * 100)
                              : 0;
                          return (
                            <tr key={rm.id}>
                              <td className="py-3 pr-4 font-semibold text-slate-900">
                                {rm.targetRole}
                              </td>
                              <td className="py-3 px-4 capitalize">
                                <span
                                  className={
                                    rm.status === 'active'
                                      ? 'text-emerald-700 font-semibold text-xs'
                                      : 'text-slate-500 text-xs'
                                  }
                                >
                                  {rm.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 tabular-nums text-slate-600">
                                {rm.phases.length} phases
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-600 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs tabular-nums text-slate-600">
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pl-4 text-right text-xs text-slate-500 tabular-nums">
                                {formatDate(rm.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 mb-4">
                  Recent AI Generations
                </h2>
                {selectedUserLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">No AI generation requests logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 pr-4">Prompt Summary</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 pl-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedUserLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-3 pr-4 text-slate-700 max-w-md truncate">
                              {log.promptSummary}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  log.status === 'success'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="py-3 pl-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedLog(log)}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* AI GENERATION LOGS */}
          {page === 'logs' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">AI Generation Logs</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  View-only audit trail of every server-side Gemini roadmap generation.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start">
                  {(['all', 'success', 'error'] as LogFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setLogFilter(f);
                        setLogPageNum(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        logFilter === f
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPageNum(1);
                    }}
                    placeholder="Filter by user or prompt..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Prompt Summary</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={5} className="px-4 py-4">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          </tr>
                        ))
                      ) : paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                            No AI generation logs recorded yet.
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{log.userName}</div>
                              <div className="text-xs text-slate-500 font-mono">
                                {log.userEmail}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 max-w-md truncate">
                              {log.promptSummary}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  log.status === 'success'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedLog(log)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="tabular-nums">
                    Showing {filteredLogs.length === 0 ? 0 : (logPageNum - 1) * PAGE_SIZE + 1}
                    –{Math.min(logPageNum * PAGE_SIZE, filteredLogs.length)} of{' '}
                    {filteredLogs.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={logPageNum <= 1}
                      onClick={() => setLogPageNum((p) => Math.max(1, p - 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-semibold text-slate-700 tabular-nums">
                      {logPageNum} / {logTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={logPageNum >= logTotalPages}
                      onClick={() => setLogPageNum((p) => Math.min(logTotalPages, p + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
            </>
        </main>
      </div>

      {/* AI Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Generation Detail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  <span
                    className={
                      selectedLog.status === 'success'
                        ? 'text-emerald-700 font-semibold'
                        : 'text-red-700 font-semibold'
                    }
                  >
                    {selectedLog.status === 'success' ? 'Success' : 'Error'}
                  </span>{' '}
                  · {selectedLog.userName} ({selectedLog.userEmail}) ·{' '}
                  {formatDateTime(selectedLog.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close modal"
                className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Prompt</h4>
                <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed max-h-64 overflow-auto whitespace-pre-wrap break-words">
                  {selectedLog.prompt}
                </pre>
              </div>

              {selectedLog.status === 'error' ? (
                <div>
                  <h4 className="text-xs font-bold text-red-700 mb-2">Error Message</h4>
                  <pre className="bg-red-950 text-red-100 p-4 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {selectedLog.errorMessage || 'Generation failed validation.'}
                  </pre>
                </div>
              ) : (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Validated JSON Response
                  </h4>
                  <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed max-h-80 overflow-auto whitespace-pre-wrap break-words">
                    {selectedLog.responseSummary}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
