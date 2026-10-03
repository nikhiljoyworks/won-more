import React, { useState, useEffect } from 'react';
import {
  Download,
  Search,
  CheckCircle,
  Clock,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { useMerchantData } from '../../context/MerchantDataContext';
import { Lead } from '../../types';
import { getMerchantLeadsRpc, updateLeadStatusRpc } from '../../lib/supabase';
import { exportLeadsToCsv, formatDate } from '../../lib/utils';
import { broadcastShopLeadEvent } from '../../lib/realtime';
import { toast } from '../../context/ToastContext';

export const MerchantLeads: React.FC = () => {
  const { shop, sessionToken } = useMerchantAuth();
  const { campaigns, registerLeadListener } = useMerchantData();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unscratched' | 'pending' | 'claimed'>('all');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Server-side pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated leads from server
  const fetchLeads = async () => {
    if (!shop || !sessionToken) return;
    setLoading(true);
    try {
      const result = await getMerchantLeadsRpc(sessionToken, {
        campaignId: selectedCampaignId,
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
      });

      setLeads(result.leads || []);
      setTotalCount(result.total_count || 0);
      setTotalPages(Math.max(result.total_pages || 1, 1));
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [shop?.id, sessionToken, selectedCampaignId, statusFilter, debouncedSearch, page]);

  // Listen to live lead events from the persistent central connection (0 channel churn)
  useEffect(() => {
    const unregister = registerLeadListener({
      onNewLead: (newLead) => {
        if (newLead) {
          if (page === 1 && !debouncedSearch) {
            setLeads((prev) => {
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev.slice(0, pageSize - 1)];
            });
          }
          setTotalCount((c) => c + 1);
        } else {
          fetchLeads();
        }
      },
      onStatusUpdated: (leadId, status) => {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: status as any } : l))
        );
      },
    });

    return unregister;
  }, [page, debouncedSearch, pageSize, registerLeadListener]);

  const toggleLeadStatus = async (leadId: string, currentStatus: string) => {
    if (currentStatus === 'unscratched') {
      toast.error('Cannot claim an unscratched card. Customer must scratch the card first.');
      return;
    }

    const nextStatus = currentStatus === 'pending' ? 'claimed' : 'pending';
    if (!sessionToken) return;

    try {
      const success = await updateLeadStatusRpc(sessionToken, leadId, nextStatus);
      if (success) {
        setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: nextStatus as any } : l)));
        if (shop?.id) {
          broadcastShopLeadEvent(shop.id, 'LEAD_STATUS_UPDATED', {
            leadId,
            status: nextStatus,
          });
        }
        toast.success(`Marked as ${nextStatus === 'claimed' ? 'Claimed' : 'Pending'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead status');
    }
  };

  const handleExportCsv = async () => {
    if (!shop || !sessionToken) return;
    setIsExporting(true);
    try {
      // Pull all matching leads across all pages without pagination
      const allLeads = await getMerchantLeadsRpc(sessionToken, {
        campaignId: selectedCampaignId,
        search: debouncedSearch,
        status: statusFilter,
      });

      exportLeadsToCsv(allLeads, `${shop?.slug || 'shop'}-leads.csv`);
      toast.success(`Exported ${allLeads.length} leads successfully!`);
    } catch (err: any) {
      console.error('CSV export failed:', err);
      toast.error('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">Customer Leads & Winners</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Stream
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage in-store scratch participants, verification codes, and redemption claims
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={totalCount === 0 || isExporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                <span>Exporting All Leads...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Export CSV ({totalCount} Leads)</span>
                <span className="sm:hidden">Export CSV ({totalCount})</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:flex-1 md:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, code, or prize..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-brand"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
            {/* Campaign-wise selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Campaign:</span>
              <select
                value={selectedCampaignId}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-brand cursor-pointer truncate"
              >
                <option value="all">🌟 All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} (/{c.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium shrink-0">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['all', 'unscratched', 'pending', 'claimed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition shrink-0 whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-teal-brand text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all'
                    ? 'All'
                    : st === 'unscratched'
                    ? '⏳ Unscratched'
                    : st === 'pending'
                    ? '🕒 Pending'
                    : '✅ Claimed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-brand" />
              <span>Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No customer leads matching the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">WhatsApp Phone</th>
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Prize Won</th>
                    <th className="px-5 py-3">Redemption Code</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900">{l.customer_name}</p>
                        {l.customer_email && (
                          <p className="text-[11px] text-slate-400">{l.customer_email}</p>
                        )}
                        {l.custom_data && Object.keys(l.custom_data).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.entries(l.custom_data).map(([key, val]) => (
                              <span
                                key={key}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium border border-slate-200"
                              >
                                <span className="font-semibold capitalize text-slate-700 mr-1">{key}:</span>{' '}
                                {String(val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">{l.customer_phone}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/70 rounded-lg text-xs font-semibold">
                          {l.campaign?.title || 'Campaign'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {l.status === 'unscratched' ? (
                          <span className="text-slate-400 italic text-[11px]">⏳ Card Not Scratched Yet</span>
                        ) : (
                          <span className="text-teal-brand font-semibold">{l.reward_won}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {l.status === 'unscratched' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="font-bold text-coral-brand">{l.redemption_code}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {l.status === 'unscratched' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                            <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" /> Unscratched
                          </span>
                        ) : l.status === 'claimed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" /> Claimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600 shrink-0" /> Pending Claim
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{formatDate(l.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {l.status === 'unscratched' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600/90 font-medium italic py-1 px-2">
                            <ShieldAlert className="w-3 h-3 text-amber-500" /> Awaiting Scratch
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleLeadStatus(l.id, l.status)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-lg transition"
                          >
                            Mark as {l.status === 'claimed' ? 'Pending' : 'Claimed'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls Footer */}
          {totalCount > 0 && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-slate-900">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                <span className="font-semibold text-slate-900">{totalCount}</span> results
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || loading}
                  title="First page"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1 || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium text-slate-700 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="px-3 py-1 text-slate-500 font-medium">
                  Page <strong className="text-slate-800">{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages || loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium text-slate-700 transition"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || loading}
                  title="Last page"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};
