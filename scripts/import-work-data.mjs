// Run from project root: node scripts/import-work-data.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { createInterface } from 'readline';

const EMAIL = 'stelmakhadam@gmail.com';

const firebaseConfig = {
  apiKey: 'AIzaSyD4d4hiV0Zn0OaXxuLgYTP99rlg54VnBeg',
  authDomain: 'momentum-4acf1.firebaseapp.com',
  projectId: 'momentum-4acf1',
  storageBucket: 'momentum-4acf1.firebasestorage.app',
  messagingSenderId: '737833970070',
  appId: '1:737833970070:web:c7963a9ec9b219b5e0d5b7',
};

// ── Crew definitions ──────────────────────────────────────────────────────────
// If a crew with this name already exists in Firestore, its ID is reused.
const CREW_DEFS = [
  { key: 'C1', fallbackId: 'crew-uniview1',     name: 'Uniview 1',    color: '#4A90E2' },
  { key: 'C2', fallbackId: 'crew-uniview2',     name: 'Uniview 2',    color: '#E8924A' },
  { key: 'CC', fallbackId: 'crew-conceptlivin', name: 'ConceptLivin', color: '#27AE60' },
];

const MEMBER_DEFS = [
  { fallbackId: 'member-sanya',  name: 'Sanya'  },
  { fallbackId: 'member-andrey', name: 'Andrey' },
];

// ── Work days ──────────────────────────────────────────────────────────────────
// [date, windows, doors, crewKey('C1'|'C2'|'CC'|null), isCrewLead, comment, isOff]
const DAY_DATA = [
  // Week Dec 29 – Jan 4 (holiday week, all off)
  ['2025-12-29', 0,  0,  null, false, '', true],
  ['2025-12-30', 0,  0,  null, false, '', true],
  ['2025-12-31', 0,  0,  null, false, '', true],
  ['2026-01-01', 0,  0,  null, false, '', true],
  ['2026-01-02', 0,  0,  null, false, '', true],

  // Week Jan 5
  ['2026-01-05', 5,  0,  'C2', true,  '', false],
  ['2026-01-06', 4,  0,  'C2', true,  '', false],
  ['2026-01-07', 3,  0,  'C1', true,  '', false],
  ['2026-01-08', 0,  0,  null, false, '', true],
  ['2026-01-09', 0,  0,  null, false, '', true],

  // Week Jan 12
  ['2026-01-12', 8,  0,  'CC', false, '$35 gas', false],
  ['2026-01-13', 0,  2,  'C1', true,  '', false],
  ['2026-01-14', 4,  0,  'C2', false, '', false],
  ['2026-01-15', 3,  0,  'C1', true,  '$300', false],
  ['2026-01-16', 1,  2,  'C1', true,  '', false],

  // Week Jan 19
  ['2026-01-19', 3,  0,  'C1', true,  '$300, $60 gas', false],
  ['2026-01-20', 5,  0,  'C1', true,  '', false],
  ['2026-01-21', 6,  0,  'CC', false, '$200', false],
  ['2026-01-22', 4,  0,  'C1', true,  '$70 gas', false],
  ['2026-01-23', 0,  0,  null, false, '', true],

  // Week Jan 26
  ['2026-01-26', 0,  0,  null, false, '', true],
  ['2026-01-27', 0,  1,  'C1', true,  '$20 gas', false],
  ['2026-01-28', 2,  2,  'C2', false, '', false],
  ['2026-01-29', 6,  0,  'C2', true,  '', false],
  ['2026-01-30', 0,  2,  'C2', true,  '', false],

  // Week Feb 2
  ['2026-02-02', 4,  0,  'C2', true,  '', false],
  ['2026-02-03', 0,  2,  'C1', true,  '', false],
  ['2026-02-04', 0,  0,  null, false, '', true],
  ['2026-02-05', 0,  0,  null, false, '', true],
  ['2026-02-06', 0,  0,  null, false, '', true],

  // Week Feb 9
  ['2026-02-09', 4,  0,  'C2', true,  '', false],
  ['2026-02-10', 2,  2,  'C1', true,  '', false],
  ['2026-02-11', 8,  0,  'C2', true,  '', false],
  ['2026-02-12', 0,  2,  'C1', true,  'Sanya', false],
  ['2026-02-13', 0,  0,  null, false, '', true],

  // Week Feb 16
  ['2026-02-16', 4,  0,  'C1', true,  'Sanya', false],
  ['2026-02-17', 7,  1,  'CC', false, '', false],
  ['2026-02-18', 4,  1,  'C1', true,  '$150 extra for extra work', false],
  ['2026-02-19', 4,  0,  'C1', true,  '', false],
  ['2026-02-20', 4,  1,  'C2', false, '', false],

  // Week Feb 23  (includes Saturday Feb 28 — ConceptLivin Harrisburg trip)
  ['2026-02-23', 5,  0,  'C2', false, '', false],
  ['2026-02-24', 9,  1,  'C2', false, '2 day job, done in 1 day, 2x pay', false],
  ['2026-02-25', 8,  0,  'C1', false, 'Andrey, Sanya', false],
  ['2026-02-26', 6,  0,  'C2', false, '', false],
  ['2026-02-27', 7,  1,  'C1', false, '', false],
  ['2026-02-28', 20, 0,  'CC', false, 'Harrisburg, 17.5h with driving', false],

  // Week Mar 2
  ['2026-03-02', 4,  0,  'C2', true,  '', false],
  ['2026-03-03', 0,  2,  'C2', true,  '', false],
  ['2026-03-04', 4,  0,  'C2', true,  '', false],
  ['2026-03-05', 0,  0,  null, false, '', true],
  ['2026-03-06', 0,  2,  'C1', true,  '', false],

  // Week Mar 9
  ['2026-03-09', 1,  2,  'C1', false, '', false],
  ['2026-03-10', 9,  0,  'C1', false, '', false],
  ['2026-03-11', 6,  0,  'C2', false, '', false],
  ['2026-03-12', 6,  0,  'C1', false, '', false],
  ['2026-03-13', 0,  2,  'C1', false, '', false],

  // Week Mar 16
  ['2026-03-16', 0,  2,  'C1', false, '', false],
  ['2026-03-17', 4,  0,  'C2', false, '', false],
  ['2026-03-18', 0,  4,  'C1', false, '', false],
  ['2026-03-19', 6,  0,  'C2', false, '', false],
  ['2026-03-20', 4,  0,  'C1', false, '', false],

  // Week Mar 23
  ['2026-03-23', 5,  0,  'C1', false, '', false],
  ['2026-03-24', 4,  0,  'C2', true,  '', false],
  ['2026-03-25', 0,  2,  'C2', false, 'finishing previous job, extra $', false],
  ['2026-03-26', 3,  0,  'C2', true,  '', false],
  ['2026-03-27', 0,  2,  'C1', true,  '', false],

  // Week Mar 30
  ['2026-03-30', 0,  2,  'C2', true,  '', false],
  ['2026-03-31', 4,  0,  'C1', false, '', false],
  ['2026-04-01', 5,  0,  'C2', true,  '', false],
  ['2026-04-02', 3,  0,  'C2', true,  'with Max', false],
  ['2026-04-03', 0,  2,  'C2', true,  '', false],

  // Week Apr 6
  ['2026-04-06', 0,  0,  null, false, '', true],
  ['2026-04-07', 5,  0,  'C1', false, '', false],
  ['2026-04-08', 1,  2,  'C1', true,  '', false],
  ['2026-04-09', 2,  0,  'C1', true,  '$200', false],
  ['2026-04-10', 0,  2,  'C2', false, '', false],

  // Week Apr 13
  ['2026-04-13', 0,  0,  null, false, '', true],
  ['2026-04-14', 2,  1,  'C2', false, '', false],
  ['2026-04-15', 8,  0,  'C1', false, '', false],
  ['2026-04-16', 3,  0,  'C1', true,  '', false],
  ['2026-04-17', 0,  2,  'C1', true,  '', false],

  // Week Apr 20
  ['2026-04-20', 5,  0,  'C2', false, '', false],
  ['2026-04-21', 0,  1,  'C2', true,  '$330-350', false],
  ['2026-04-22', 5,  0,  'C2', true,  '', false],
  ['2026-04-23', 5,  0,  'C2', false, '', false],
  ['2026-04-24', 3,  0,  'C2', true,  '$300', false],

  // Week Apr 27  (Uniview 2 not yet paid)
  ['2026-04-27', 6,  0,  'C2', false, '', false],
  ['2026-04-28', 0,  1,  'C2', true,  '', false],
  ['2026-04-29', 8,  0,  'C2', false, '', false],
  ['2026-04-30', 15, 0,  'C1', false, '', false],
  ['2026-05-01', 4,  0,  'C2', true,  '', false],

  // Week May 4  (current week, no payment yet)
  ['2026-05-04', 7,  0,  'C2', true,  '', false],
  ['2026-05-05', 0,  1,  'C2', true,  '', false],
  ['2026-05-06', 3,  0,  'C2', true,  'Installing new bay', false],
  ['2026-05-07', 1,  1,  'C2', true,  '', false],
  ['2026-05-08', 0,  1,  'C2', true,  '', false],
];

// ── Week payments ──────────────────────────────────────────────────────────────
// Only paid crews are listed. Omitted crew = not paid (app defaults to unpaid).
const WEEK_PAYMENTS = [
  ['2026-01-05', ['C1', 'C2']],
  ['2026-01-12', ['C1', 'C2', 'CC']],
  ['2026-01-19', ['C1', 'CC']],          // Uniview 2 didn't work this week
  ['2026-01-26', ['C1', 'C2']],
  ['2026-02-02', ['C1', 'C2']],
  ['2026-02-09', ['C1', 'C2']],
  ['2026-02-16', ['C1', 'C2', 'CC']],
  ['2026-02-23', ['C1', 'C2', 'CC']],
  ['2026-03-02', ['C1', 'C2']],
  ['2026-03-09', ['C1', 'C2']],
  ['2026-03-16', ['C1', 'C2']],
  ['2026-03-23', ['C1', 'C2']],
  ['2026-03-30', ['C1', 'C2']],
  ['2026-04-06', ['C1', 'C2']],
  ['2026-04-13', ['C1', 'C2']],
  ['2026-04-20', ['C2']],                // Uniview 1 didn't work this week
  ['2026-04-27', ['C1']],                // Uniview 2 not yet paid
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function promptPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`Password for ${EMAIL}: `, answer => { rl.close(); resolve(answer); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const password = await promptPassword();

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log('\nSigning in…');
  let userRecord;
  try {
    userRecord = await signInWithEmailAndPassword(auth, EMAIL, password);
  } catch (e) {
    console.error('Sign-in failed:', e.message);
    process.exit(1);
  }
  const uid = userRecord.user.uid;
  console.log(`Signed in. UID: ${uid}\n`);

  // ── Resolve crew IDs (reuse existing if names match) ─────────────────────
  const crewIdMap = {};
  const existingCrews = await getDocs(collection(db, 'users', uid, 'workCrews'));
  const byName = {};
  existingCrews.forEach(d => { byName[d.data().name] = d.id; });

  const batch = writeBatch(db);

  for (const def of CREW_DEFS) {
    if (byName[def.name]) {
      crewIdMap[def.key] = byName[def.name];
      console.log(`  crew "${def.name}" → reusing ${byName[def.name]}`);
    } else {
      crewIdMap[def.key] = def.fallbackId;
      batch.set(doc(db, 'users', uid, 'workCrews', def.fallbackId), { name: def.name, color: def.color });
      console.log(`  crew "${def.name}" → creating ${def.fallbackId}`);
    }
  }

  // ── Resolve member IDs ────────────────────────────────────────────────────
  const existingMembers = await getDocs(collection(db, 'users', uid, 'workMembers'));
  const memberByName = {};
  existingMembers.forEach(d => { memberByName[d.data().name] = d.id; });

  for (const def of MEMBER_DEFS) {
    if (!memberByName[def.name]) {
      batch.set(doc(db, 'users', uid, 'workMembers', def.fallbackId), { name: def.name });
      console.log(`  member "${def.name}" → creating`);
    } else {
      console.log(`  member "${def.name}" → already exists`);
    }
  }

  // ── Queue work days ───────────────────────────────────────────────────────
  for (const [date, windows, doors, crewKey, isCrewLead, comment, isOff] of DAY_DATA) {
    const data = isOff
      ? { windows: 0, doors: 0, crewId: null, memberIds: [], isCrewLead: false, comment: '', isOff: true }
      : { windows, doors, crewId: crewIdMap[crewKey], memberIds: [], isCrewLead, comment, isOff: false };
    batch.set(doc(db, 'users', uid, 'workDays', date), data);
  }
  console.log(`\n  Queued ${DAY_DATA.length} work days`);

  // ── Queue week payments ───────────────────────────────────────────────────
  for (const [mondayId, paidCrewKeys] of WEEK_PAYMENTS) {
    const weekData = {};
    for (const key of paidCrewKeys) {
      weekData[crewIdMap[key]] = { paid: true, amount: 0 };
    }
    batch.set(doc(db, 'users', uid, 'workWeeks', mondayId), weekData);
  }
  console.log(`  Queued ${WEEK_PAYMENTS.length} week payment records`);

  // ── Commit ────────────────────────────────────────────────────────────────
  console.log('\nCommitting…');
  await batch.commit();
  console.log('Done! All data imported successfully.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
