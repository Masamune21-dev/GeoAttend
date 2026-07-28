import type { TechnicianTeam } from '@/types/api';

/**
 * Tim jaga lembur malam untuk teknisi. Saat ada gangguan malam hari, tim yang
 * siaga ditentukan oleh PARITAS TANGGAL: tim ganjil pada tanggal ganjil
 * (1, 3, 5, …), tim genap pada tanggal genap (2, 4, 6, …).
 */

export const TEAM_LABEL: Record<TechnicianTeam, string> = {
  ganjil: 'Tim Ganjil',
  genap: 'Tim Genap',
};

/** Tim yang siaga pada sebuah tanggal "yyyy-MM-dd". */
export function teamOnDuty(dateStr: string): TechnicianTeam {
  return Number(dateStr.slice(-2)) % 2 === 1 ? 'ganjil' : 'genap';
}

/** true bila tim tersebut yang siaga lembur pada tanggal itu. */
export function isTeamOnDuty(team: TechnicianTeam | null | undefined, dateStr: string): boolean {
  return team != null && teamOnDuty(dateStr) === team;
}
