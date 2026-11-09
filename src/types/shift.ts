export interface ShiftItem {
  id: string;
  label: string;
  timings: string;
  defaultFee: number;
  description?: string;
  isSystem?: boolean;
}

export const INITIAL_SHIFTS: ShiftItem[] = [
  {
    id: 'shift_morning',
    label: 'Morning Shift',
    timings: '08:00 AM - 02:00 PM',
    defaultFee: 1200,
    description: 'Fresh morning study hours, includes tea/coffee access.',
    isSystem: true,
  },
  {
    id: 'shift_evening',
    label: 'Evening Shift',
    timings: '02:00 PM - 08:00 PM',
    defaultFee: 1000,
    description: 'Post-college/work focused reading session.',
    isSystem: true,
  },
  {
    id: 'shift_fullday',
    label: 'Full Day Shift',
    timings: '08:00 AM - 08:00 PM',
    defaultFee: 1800,
    description: '12-hour comprehensive study pass with dedicated locker.',
    isSystem: true,
  },
  {
    id: 'shift_night',
    label: 'Night Owl Shift',
    timings: '08:00 PM - 02:00 AM',
    defaultFee: 1400,
    description: 'Quiet night research & intense competitive exam prep.',
    isSystem: true,
  },
];
