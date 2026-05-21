export type AppCategory = 'All' | 'Work' | 'Personal';

export interface AppItem {
  id: string; // Document ID
  name: string;
  description: string;
  version: string;
  date: string;
  category: 'Work' | 'Personal';
  downloadUrl?: string; // It replaces iconName and apkSize for actual url
  iconName?: string;
  apkSize?: string;
  checksum?: string;
}

