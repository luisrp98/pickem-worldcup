import { getAdminFirestore } from './firebase/admin';
import type { Tournament, Match } from './matches';

const CACHE_COLLECTION = 'cache';
const TOURNAMENT_META_DOC_ID = '_tournament';

export async function loadTournament(): Promise<Tournament> {
  const db = getAdminFirestore();
  const snap = await db.collection(CACHE_COLLECTION).get();

  if (snap.empty) {
    throw new Error('Tournament not in cache. Run the syncTournament function first.');
  }

  const matches: Match[] = [];
  let name = 'Tournament';

  for (const doc of snap.docs) {
    const data = doc.data();
    if (doc.id === TOURNAMENT_META_DOC_ID) {
      if (typeof data?.name === 'string') {
        name = data.name;
      }
    } else {
      matches.push(data as Match);
    }
  }

  if (matches.length === 0) {
    throw new Error('Tournament cache has no match documents.');
  }

  return { name, matches };
}
