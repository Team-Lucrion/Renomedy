export type FamilyMember = {
  id: string;
  name: string;
  age: number;
  relationship: string;
  isSelf: boolean;
  conditions: string[];
  avatarUrl?: string;
};

export type Medication = {
  id: string;
  memberId: string;
  name: string;
  strength: string;
  schedule: string;
  time: string;
  remainingDoses: number;
  totalDoses: number;
  status: 'taken' | 'snoozed' | 'missed' | 'pending';
  refillRisk: 'Safe' | 'Risk Soon' | 'Will Run Out' | 'Out of Stock';
  icon?: string;
};

export const familyMembers: FamilyMember[] = [
  {
    id: '1',
    name: 'Arjun',
    age: 34,
    relationship: 'Self',
    isSelf: true,
    conditions: ['Mild Hypertension'],
  },
  {
    id: '2',
    name: 'Mom',
    age: 62,
    relationship: 'Mother',
    isSelf: false,
    conditions: ['Diabetes Type 2', 'Thyroid'],
  },
  {
    id: '3',
    name: 'Dad',
    age: 66,
    relationship: 'Father',
    isSelf: false,
    conditions: ['Hypertension', 'Arthritis'],
  },
];

export const medications: Medication[] = [
  {
    id: '1',
    memberId: '1', // Arjun
    name: 'Atorvastatin',
    strength: '20mg',
    schedule: 'Daily',
    time: '08:00 AM',
    remainingDoses: 24,
    totalDoses: 30,
    status: 'taken',
    refillRisk: 'Safe',
  },
  {
    id: '2',
    memberId: '2', // Mom
    name: 'Metformin',
    strength: '500mg',
    schedule: 'Twice Daily',
    time: '08:00 AM',
    remainingDoses: 8,
    totalDoses: 60,
    status: 'pending',
    refillRisk: 'Risk Soon',
  },
  {
    id: '3',
    memberId: '2', // Mom
    name: 'Thyroxine',
    strength: '50mcg',
    schedule: 'Daily (Empty Stomach)',
    time: '06:30 AM',
    remainingDoses: 3,
    totalDoses: 30,
    status: 'taken',
    refillRisk: 'Will Run Out',
  },
  {
    id: '4',
    memberId: '3', // Dad
    name: 'Amlodipine',
    strength: '5mg',
    schedule: 'Daily',
    time: '09:00 AM',
    remainingDoses: 15,
    totalDoses: 30,
    status: 'missed',
    refillRisk: 'Safe',
  },
];
