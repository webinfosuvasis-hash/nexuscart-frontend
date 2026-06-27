import React, { useState } from 'react';
import {
  Search, TrendingUp, Settings2, Plus, Trash2, Edit, Check, X,
  ArrowUpDown, Pin, EyeOff, Flame, BarChart3, RefreshCw, Zap,
  Hash, Filter, Tag, Star, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import type { SearchSynonym, MerchandisingRule, SearchConfig } from '@/types';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SYNONYMS: SearchSynonym[] = [
  { id: 's1', terms: ['earphones', 'earbuds', 'headphones'], type: 'two_way' },
  { id: 's2', terms: ['sneakers', 'shoes', 'trainers', 'kicks'], type: 'two_way' },
  { id: 's3', terms: ['mobile', 'phone', 'smartphone'], type: 'two_way' },
  { id: 's4', terms: ['laptop', 'notebook', 'ultrabook'], type: 'two_way' },
  { id: 's5', terms: ['sofa'], type: 'one_way' },
];

const MOCK_RULES: MerchandisingRule[] = [
  { id: 'r1', name: 'Pin iPhone to top', type: 'pin', query: 'phone', productId: 'PRD-1001', position: 1, isActive: true },
  { id: 'r2', name: 'Boost featured products', type: 'boost', query: '*', multiplier: 1.5, isActive: true },
  { id: 'r3', name: 'Hide discontinued shoes', type: 'hide', query: 'shoes', productId: 'PRD-1009', isActive: false },
  { id: 'r4', name: 'Bury out-of-stock items', type: 'bury', query: '*', multiplier: 0.2, isActive: true },
];

const TOP_QUERIES = [
  { query: 'wireless earbuds', count: 1842, resultsFound: true, ctr: '12.4%' },
  { query: 'men shoes', count: 1241, resultsFound: true, ctr: '8.2%' },
  { query: 'yoga mat', count: 984, resultsFound: true, ctr: '15.6%' },
  { query: 'leather wallet', count: 720, resultsFound: true, ctr: '9.8%' },
  { query: 'bluetooth speaker', count: 642, resultsFound: true, ctr: '11.2%' },
  { query: 'gaming headset', count: 421, resultsFound: false, ctr: '–' },
  { query: 'cotton dupatta', count: 284, resultsFound: false, ctr: '–' },
  { query: 'smart watch band', count: 198, resultsFound: true, ctr: '6.4%' },
];

const RULE_STYLE = {
  pin: { icon: Pin, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', label: 'Pin to Top' },
  hide: { icon: EyeOff, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', label: 'Hide' },
  boost: { icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Boost' },
  bury: { icon: ArrowUpDown, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700', label: 'Bury' },
};

// ─── Component ────────────────────────────────────────────────────────────────

const SearchDiscovery: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'config' | 'synonyms' | 'rules'>('analytics');
  const [synonyms, setSynonyms] = useState(MOCK_SYNONYMS);
  const [rules, setRules] = useState(MOCK_RULES);
  const [newSynonymTerms, setNewSynonymTerms] = useState('');
  const [config, setConfig] = useState<SearchConfig>({
    enableAutoComplete: true,
    enableFuzzySearch: true,
    enableSynonyms: true,
    enableSpellCheck: true,
    enableProductRecommendations: true,
    boostInStock: true,
    boostFeatured: true,
    resultLimit: 20,
  });

  const addSynonym = () => {
    if (!newSynonymTerms.trim()) return;
    const terms = newSynonymTerms.split(',').map((t) => t.trim()).filter(Boolean);
    if (terms.length < 2) { toast.error('Add at least 2 terms'); return; }
    setSynonyms((s) => [...s, { id: `s${Date.now()}`, terms, type: 'two_way' }]);
    setNewSynonymTerms('');
    toast.success('Synonym group added');
  };

  const delSynonym = (id: string) => { setSynonyms((s) => s.filter((x) => x.id !== id)); toast.success('Synonym removed'); };

  const toggleRule = (id: string) => {
    setRules((rs) => rs.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const zeroResultQueries = TOP_QUERIES.filter((q) => !q.resultsFound);

  return (
    <div>
      <PageHeader title="Search & Discovery" subtitle="Tune search experience, synonyms, and merchandising rules"
        action={
          <Btn variant="outline" onClick={() => toast.success('Search index rebuilt!')}><RefreshCw size={15} /> Rebuild Index</Btn>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Searches', value: '48.2K', change: '+12%', icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'No-Result Rate', value: '4.2%', change: '-1.1%', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
          { label: 'Click-Through Rate', value: '10.8%', change: '+2.3%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Search Revenue', value: '₹2.4L', change: '+18%', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-xs font-semibold ${s.change.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>{s.change} vs last month</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-5 w-fit">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'config', label: 'Configuration', icon: Settings2 },
          { id: 'synonyms', label: 'Synonyms', icon: Hash },
          { id: 'rules', label: 'Merchandising', icon: Filter },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Queries */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-600" /> Top Search Queries
                </h3>
                <span className="text-xs text-slate-400">Last 30 days</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500">#</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500">Query</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500">Searches</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500">CTR</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {TOP_QUERIES.map((q, i) => (
                    <tr key={q.query} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="p-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Search size={12} className="text-slate-400" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">{q.query}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 tabular-nums">{q.count.toLocaleString()}</td>
                      <td className="p-3 font-semibold text-emerald-600">{q.ctr}</td>
                      <td className="p-3">
                        {q.resultsFound
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={11} /> Found</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-rose-600"><X size={11} /> None</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Zero Result Queries */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500" /> Zero-Result Queries
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">{zeroResultQueries.length}</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">Customers searched for these terms but found no products. Consider adding products or synonyms.</p>
              <div className="space-y-2">
                {zeroResultQueries.map((q) => (
                  <div key={q.query} className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Search size={13} className="text-rose-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{q.query}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600 font-bold">{q.count} searches</span>
                      <button onClick={() => toast.info(`Adding synonym for "${q.query}"`)}
                        className="text-xs font-semibold text-indigo-600 hover:underline">+ Synonym</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Zap size={12} /> Recommendations
                </p>
                <ul className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 space-y-1">
                  <li>• Add "gaming headset" as synonym for "headphones"</li>
                  <li>• Create a "Dupattas" category for traditional wear</li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings2 size={16} className="text-indigo-600" /> Search Settings
            </h3>
            <div className="space-y-4">
              {(Object.entries(config) as [keyof SearchConfig, any][]).filter(([k]) => typeof config[k] === 'boolean').map(([key, val]) => (
                <label key={key} className="flex items-center justify-between cursor-pointer py-1.5 border-b border-slate-50 dark:border-slate-700/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').replace('enable', '').trim()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {key === 'enableAutoComplete' && 'Show suggestions as user types'}
                      {key === 'enableFuzzySearch' && 'Match similar spellings (typo tolerance)'}
                      {key === 'enableSynonyms' && 'Use synonym groups for better results'}
                      {key === 'enableSpellCheck' && 'Auto-correct common misspellings'}
                      {key === 'enableProductRecommendations' && 'Show AI-based related products'}
                      {key === 'boostInStock' && 'Prioritize in-stock items in results'}
                      {key === 'boostFeatured' && 'Rank featured products higher'}
                    </p>
                  </div>
                  <div
                    onClick={() => setConfig((c) => ({ ...c, [key]: !val }))}
                    className={`w-11 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0 ${val ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm m-0.5 transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>
              ))}

              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">Results per page</label>
                <select value={config.resultLimit} onChange={(e) => setConfig((c) => ({ ...c, resultLimit: +e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                  {[12, 16, 20, 24, 36, 48].map((n) => <option key={n} value={n}>{n} results</option>)}
                </select>
              </div>
            </div>
            <Btn className="w-full justify-center mt-4" onClick={() => toast.success('Search configuration saved!')}>
              <Check size={15} /> Save Configuration
            </Btn>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Star size={16} className="text-amber-500" /> Search Recommendations
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Configure which products appear in the recommendation engine.</p>
            <div className="space-y-3">
              {[
                { label: 'Recently Viewed', desc: 'Show products the customer browsed', enabled: true },
                { label: 'Trending Now', desc: 'Best sellers in the last 48 hours', enabled: true },
                { label: 'Similar Products', desc: 'AI-matched based on attributes', enabled: true },
                { label: 'Frequently Bought Together', desc: 'Cross-sell complementary items', enabled: false },
                { label: 'Personalized Picks', desc: 'ML-based individual recommendations', enabled: false },
              ].map(({ label, desc, enabled }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full cursor-pointer transition-colors flex-shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                    onClick={() => toast.info(`Toggled ${label}`)}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm m-0.5 transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Synonyms Tab */}
      {activeTab === 'synonyms' && (
        <div className="space-y-5">
          <Card className="p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">Add Synonym Group</h3>
            <div className="flex gap-2">
              <input value={newSynonymTerms} onChange={(e) => setNewSynonymTerms(e.target.value)}
                placeholder="e.g. laptop, notebook, ultrabook (comma-separated)"
                className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && addSynonym()} />
              <Btn onClick={addSynonym}><Plus size={15} /> Add</Btn>
            </div>
            <p className="text-xs text-slate-400 mt-1">Separate terms with commas. Two-way synonyms match in both directions.</p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {synonyms.map((s) => (
              <Card key={s.id} className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
                  <Hash size={14} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {s.terms.map((t, i) => (
                      <React.Fragment key={t}>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">{t}</span>
                        {i < s.terms.length - 1 && <span className="text-slate-400 text-xs self-center">⇌</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 capitalize">{s.type.replace('_', '-')} synonym</p>
                </div>
                <button onClick={() => delSynonym(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Merchandising Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-slate-500">{rules.filter((r) => r.isActive).length} active rules</p>
            <Btn onClick={() => toast.info('Create merchandising rule wizard')}><Plus size={14} /> Add Rule</Btn>
          </div>

          {rules.map((rule) => {
            const style = RULE_STYLE[rule.type as keyof typeof RULE_STYLE];
            const RuleIcon = style?.icon || Pin;
            return (
              <Card key={rule.id} className={`p-4 ${!rule.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style?.bg}`}>
                    <RuleIcon size={17} className={style?.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${style?.bg} ${style?.color}`}>
                        {style?.label}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{rule.name}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>Query: <strong className="text-slate-700 dark:text-slate-300">{rule.query === '*' ? 'All queries' : `"${rule.query}"`}</strong></span>
                      {rule.position && <span>Position: #{rule.position}</span>}
                      {rule.multiplier && <span>Multiplier: ×{rule.multiplier}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleRule(rule.id)}
                      className={`w-10 h-5 rounded-full transition-colors ${rule.isActive ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm m-0.5 transition-transform ${rule.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <button onClick={() => toast.info('Edit rule')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><Edit size={14} /></button>
                    <button onClick={() => setRules((rs) => rs.filter((r) => r.id !== rule.id))} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchDiscovery;
