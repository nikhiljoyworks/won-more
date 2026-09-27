import React, { useState, useEffect } from 'react';
import { Download, Search, CheckCircle, Clock, Users, Filter } from 'lucide-react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { MerchantLayout } from '../../components/merchant/MerchantLayout';
import { Lead } from '../../types';
import { supabase, getMerchantLeadsRpc, updateLeadStatusRpc } from '../../lib/supabase';
import { exportLeadsToCsv, formatDate } from '../../lib/utils';

export const MerchantLeads: React.FC = () => {
  const { shop, sessionToken } = useMerchantAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unscratched' | 'pending' | 'claimed'>('all');
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    if (!shop) return;
    try {
      // Fetch campaigns for dropdown
      const { data: campData } = await supabase
        .from('campaigns')
        .select('id, title, slug')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });
      setCampaigns(campData || []);

      if (sessionToken) {
        const data = await getMerchantLeadsRpc(sessionToken, selectedCampaignId);
        setLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [shop?.id, sessionToken, selectedCampaignId]);

  const toggleLeadStatus = async (leadId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' ? 'claimed' : 'pending';
    if (!sessionToken) return;

    const success = await updateLeadStatusRpc(sessionToken, leadId, nextStatus);
    if (success) {
      setLeads(leads.map(l => (l.id === leadId ? { ...l, status: nextStatus as any } : l)));
    }
  };

  const filtered = leads.filter(l => {
    const matchesSearch =
      l.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      l.customer_phone.includes(search) ||
      l.redemption_code.toLowerCase().includes(search.toLowerCase()) ||
      l.reward_won.toLowerCase().includes(search.toLowerCase()) ||
      (l.campaign?.title && l.campaign.title.toLowerCase().includes(search.toLowerCase())) ||
      (l.custom_data && JSON.stringify(l.custom_data).toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesCampaign = selectedCampaignId === 'all' || l.campaign_id === selectedCampaignId || l.campaign?.id === selectedCampaignId;
    return matchesSearch && matchesStatus && matchesCampaign;
  });

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customer Leads & Winners</h2>
            <p className="text-xs text-slate-500">
              Manage in-store scratch participants, verification codes, and redemption claims
            </p>
          </div>

          <button
            onClick={() => exportLeadsToCsv(filtered, `${shop?.slug || 'shop'}-leads.csv`)}
            disabled={filtered.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 w-full sm:w-auto"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Export CSV ({filtered.length} Leads)</span>
            <span className="sm:hidden">Export CSV ({filtered.length})</span>
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
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-brand cursor-pointer truncate"
              >
                <option value="all">🌟 All Campaigns</option>
                {campaigns.map(c => (
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
              {(['all', 'unscratched', 'pending', 'claimed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition shrink-0 whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-teal-brand text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'unscratched' ? '⏳ Unscratched' : st === 'pending' ? '🕒 Pending' : '✅ Claimed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500">Loading leads...</div>
          ) : filtered.length === 0 ? (
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
                  {filtered.map(l => (
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
                                <span className="font-semibold capitalize text-slate-700 mr-1">{key}:</span> {String(val)}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <Clock className="w-3 h-3 text-slate-400" /> Unscratched
                          </span>
                        ) : l.status === 'claimed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Claimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> Pending Claim
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{formatDate(l.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {l.status === 'unscratched' ? (
                          <span className="text-[11px] text-slate-400 italic py-1 px-2">Awaiting Scratch</span>
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
        </div>
      </div>
    </MerchantLayout>
  );
};
