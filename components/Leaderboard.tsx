import React, { useMemo } from 'react';
import { Trophy, Medal, TrendingUp, Users, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Player } from '../types';

interface PlayerStats {
  player: Player;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  netPoints: number;
}

interface PartnerStats {
  player1: Player;
  player2: Player;
  played: number;
  wins: number;
  winRate: number;
}

const Leaderboard: React.FC = () => {
  const { players, activeMatches, matchHistory, clearMatchHistory } = useStore();

  const { playerStats, partnerStats } = useMemo(() => {
    const pStats = new Map<string, PlayerStats>();
    const pairStats = new Map<string, PartnerStats>();

    // Initialize player stats
    players.forEach(p => {
      pStats.set(p.id, {
        player: p,
        played: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        netPoints: 0
      });
    });

    const validActiveMatches = activeMatches.filter(m => m !== null);
    const allMatches = [...matchHistory, ...validActiveMatches];

    allMatches.forEach(match => {
      if (match.scoreA === undefined || match.scoreB === undefined) return;

      const teamAWon = match.scoreA > match.scoreB;
      const teamBWon = match.scoreB > match.scoreA;
      const isDraw = match.scoreA === match.scoreB;

      const processTeam = (p1: Player, p2: Player, pointsFor: number, pointsAgainst: number, isWin: boolean, isLoss: boolean) => {
        [p1, p2].forEach(p => {
          const stat = pStats.get(p.id);
          if (stat) {
            stat.played += 1;
            if (isWin) stat.wins += 1;
            if (isLoss) stat.losses += 1;
            stat.pointsFor += pointsFor;
            stat.pointsAgainst += pointsAgainst;
            stat.netPoints = stat.pointsFor - stat.pointsAgainst;
            stat.winRate = stat.played > 0 ? Math.round((stat.wins / stat.played) * 100) : 0;
          }
        });

        // Partner stats
        const pairId = [p1.id, p2.id].sort().join('-');
        if (!pairStats.has(pairId)) {
          pairStats.set(pairId, {
            player1: p1,
            player2: p2,
            played: 0,
            wins: 0,
            winRate: 0
          });
        }
        const pairStat = pairStats.get(pairId)!;
        pairStat.played += 1;
        if (isWin) pairStat.wins += 1;
        pairStat.winRate = Math.round((pairStat.wins / pairStat.played) * 100);
      };

      processTeam(match.teamA.player1, match.teamA.player2, match.scoreA, match.scoreB, teamAWon, teamBWon);
      processTeam(match.teamB.player1, match.teamB.player2, match.scoreB, match.scoreA, teamBWon, teamAWon);
    });

    const sortedPlayerStats = Array.from(pStats.values())
      .filter(s => s.played > 0)
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
        return b.wins - a.wins;
      });

    const sortedPartnerStats = Array.from(pairStats.values())
      .filter(s => s.played > 0)
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.wins - a.wins;
      })
      .slice(0, 5); // Top 5 partners

    return { playerStats: sortedPlayerStats, partnerStats: sortedPartnerStats };
  }, [players, activeMatches, matchHistory]);

  if (playerStats.length === 0) {
    return null;
  }

  return (
    <section className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-200 mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
            <Trophy size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-100">戰績排行榜</h3>
        </div>
        {matchHistory.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('確定要清除所有歷史戰績嗎？此操作無法復原。')) {
                clearMatchHistory();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            清除歷史紀錄
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player Leaderboard */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Medal size={16} /> 個人戰績
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">排名</th>
                  <th className="px-4 py-3">球員</th>
                  <th className="px-4 py-3 text-center">勝率</th>
                  <th className="px-4 py-3 text-center">勝-負</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">淨勝分</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((stat, idx) => (
                  <tr key={stat.player.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{stat.player.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md font-bold">
                        <TrendingUp size={12} /> {stat.winRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-300">
                      {stat.wins} - {stat.losses}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      <span className={stat.netPoints > 0 ? 'text-emerald-600 dark:text-emerald-400' : stat.netPoints < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}>
                        {stat.netPoints > 0 ? '+' : ''}{stat.netPoints}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best Partners */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Users size={16} /> 最佳搭檔 (Top 5)
          </h4>
          <div className="space-y-3">
            {partnerStats.map((stat, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-600 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{stat.player1.name}</span>
                    <span className="text-slate-300 dark:text-slate-500 text-xs">&amp;</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{stat.player2.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">合作 {stat.played} 場</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stat.winRate}%</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{stat.wins} 勝</span>
                </div>
              </div>
            ))}
            {partnerStats.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
                尚無搭檔數據
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Leaderboard;
